import { describe, it, expect, vi, beforeEach } from 'vitest'

// Every collaborator is mocked; the assertions are about which document each panel ends up showing.
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn(async () => ({ sub: 'owner-1' })) }))
vi.mock('@/lib/psp/PspClient', () => ({
  sendToBeneficiary: vi.fn(),
  acceptRtpRequest: vi.fn(),
  cancelRtpRequest: vi.fn(),
  createBeneficiary: vi.fn(),
  createRtpRequest: vi.fn(),
  listAccounts: vi.fn(async () => []),
  listBeneficiaries: vi.fn(async () => []),
  listRtpRequests: vi.fn(async () => []),
  listTransactions: vi.fn(async () => []),
  presentRtpRequest: vi.fn(),
  rejectRtpRequest: vi.fn(),
}))
vi.mock('@/lib/local/LocalStoreClient', () => ({
  cacheAccount: vi.fn(async () => {}),
  createLocalChat: vi.fn(),
  createLocalChatMessage: vi.fn(),
  createLocalContact: vi.fn(async () => ({})),
  createLocalRequest: vi.fn(async () => ({})),
  createLocalTransaction: vi.fn(async () => ({ id: 99 })),
  createPendingSend: vi.fn(async () => ({ id: 7 })),
  deleteLocalChat: vi.fn(),
  deleteLocalContact: vi.fn(async () => {}),
  deleteLocalRequest: vi.fn(async () => {}),
  deleteLocalTransaction: vi.fn(async () => {}),
  listLocalAccounts: vi.fn(async () => []),
  listLocalChatMessages: vi.fn(async () => []),
  listLocalChats: vi.fn(async () => []),
  listLocalContacts: vi.fn(async () => []),
  listLocalRequests: vi.fn(async () => []),
  listLocalTransactions: vi.fn(async () => []),
  listPendingSends: vi.fn(async () => []),
  localSpendingByContact: vi.fn(async () => []),
  searchLocalTransactions: vi.fn(async () => []),
  updateLocalRequest: vi.fn(async () => ({})),
  updateLocalTransaction: vi.fn(async () => ({})),
}))
vi.mock('@/lib/backend/enrichment', () => ({
  listContactEnrichment: vi.fn(async () => []),
  listTransactionEnrichment: vi.fn(async () => []),
  searchTransactionEnrichment: vi.fn(async () => []),
  spendingByContactEnrichment: vi.fn(async () => []),
}))

const local = await import('@/lib/local/LocalStoreClient')
const enrichment = await import('@/lib/backend/enrichment')
const { getDbSyncSnapshot } = await import('@/lib/wallet/actions')

const SETTLED = {
  id: 41,
  ownerPartyRef: 'owner-1',
  leafyPayTransferReference: 'lp-old',
  amount: 20,
  currency: 'EUR',
  note: 'last week',
  leafyPayStatus: 'settled',
  localSyncStatus: 'synced',
  createdAt: Date.parse('2026-08-01T10:00:00Z'),
}
const QUEUED = {
  id: 7,
  ownerPartyRef: 'owner-1',
  counterpartyArrangementReference: 'cp-1',
  amount: 12.5,
  currency: 'EUR',
  note: 'oat flat white',
  direction: 'sent',
  createdAt: Date.parse('2026-08-02T10:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  local.listLocalTransactions.mockResolvedValue([])
  local.listPendingSends.mockResolvedValue([])
  enrichment.listTransactionEnrichment.mockResolvedValue([])
})

// A send made offline only exists in the queue box, so without it the inspector would keep showing
// the previous settled transfer as the device's newest document.
describe('getDbSyncSnapshot', () => {
  it('shows the queued send on the device while Atlas still holds the previous transfer', async () => {
    local.listLocalTransactions.mockResolvedValue([SETTLED])
    local.listPendingSends.mockResolvedValue([QUEUED])
    enrichment.listTransactionEnrichment.mockResolvedValue([SETTLED])

    const { atlas, local: device } = await getDbSyncSnapshot()

    expect(device).toMatchObject({ amount: 12.5, status: 'queued', collection: 'pendingSends' })
    expect(atlas).toMatchObject({ amount: 20, status: 'settled' })
  })

  it('names the queue box, since Sync never carries it up', async () => {
    local.listPendingSends.mockResolvedValue([QUEUED])
    const { local: device } = await getDbSyncSnapshot()
    expect(device).toMatchObject({ collection: 'pendingSends', syncStatus: 'queued', reference: null })
  })

  it('goes back to the synced collection once the queued send is replayed', async () => {
    local.listLocalTransactions.mockResolvedValue([
      SETTLED,
      { ...SETTLED, id: 42, leafyPayTransferReference: 'lp-replayed', amount: 12.5, leafyPayStatus: 'pending', createdAt: Date.parse('2026-08-02T10:05:00Z') },
    ])

    const { local: device } = await getDbSyncSnapshot()

    expect(device).toMatchObject({ reference: 'lp-replayed', status: 'pending', collection: 'walletTransactions' })
  })

  it('keeps a settled row newer than the queue ahead of it', async () => {
    local.listLocalTransactions.mockResolvedValue([
      { ...SETTLED, createdAt: Date.parse('2026-08-03T10:00:00Z') },
    ])
    local.listPendingSends.mockResolvedValue([QUEUED])

    expect((await getDbSyncSnapshot()).local).toMatchObject({ reference: 'lp-old' })
  })

  it('ignores queue rows belonging to another owner', async () => {
    local.listLocalTransactions.mockResolvedValue([SETTLED])
    local.listPendingSends.mockResolvedValue([])

    await getDbSyncSnapshot()

    expect(local.listPendingSends).toHaveBeenCalledWith('owner-1')
  })

  it('survives an unreachable local store', async () => {
    local.listLocalTransactions.mockRejectedValue(new Error('store down'))
    local.listPendingSends.mockRejectedValue(new Error('store down'))

    expect(await getDbSyncSnapshot()).toEqual({ atlas: null, local: null })
  })
})
