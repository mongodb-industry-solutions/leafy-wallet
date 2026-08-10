import { describe, it, expect, vi, beforeEach } from 'vitest'

// Every collaborator is mocked; the assertions are about ordering and arguments, not stored data.
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
  listRequestDocs: vi.fn(async () => []),
  listTransactionEnrichment: vi.fn(async () => []),
  searchTransactionEnrichment: vi.fn(async () => []),
  spendingByContactEnrichment: vi.fn(async () => []),
}))

const psp = await import('@/lib/psp/PspClient')
const local = await import('@/lib/local/LocalStoreClient')
const { sendMoney, replayPendingSends } = await import('@/lib/wallet/actions')

const SEND = { counterpartyArrangementReference: 'cp-1', amount: 12.5, note: 'oat flat white' }

beforeEach(() => {
  vi.clearAllMocks()
  local.createPendingSend.mockResolvedValue({ id: 7 })
  local.createLocalTransaction.mockResolvedValue({ id: 99 })
})

describe('sendMoney offline', () => {
  it('queues on the device and never contacts Leafy Pay', async () => {
    const result = await sendMoney({ ...SEND, isOnline: false })

    expect(psp.sendToBeneficiary).not.toHaveBeenCalled()
    expect(local.createPendingSend).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ ok: true, status: 'local_pending' })
  })

  it('queues without a Leafy Pay reference, which is what keeps it out of Atlas', async () => {
    await sendMoney({ ...SEND, isOnline: false })

    const queued = local.createPendingSend.mock.calls[0][0]
    expect(queued).not.toHaveProperty('leafyPayTransferReference')
    expect(queued).toMatchObject({ ownerPartyRef: 'owner-1', amount: 12.5, direction: 'sent' })
  })

  it('does not write the synced collection', async () => {
    await sendMoney({ ...SEND, isOnline: false })
    expect(local.createLocalTransaction).not.toHaveBeenCalled()
  })

  it('reports failure when the device cannot queue it', async () => {
    local.createPendingSend.mockRejectedValueOnce(new Error('store down'))
    const result = await sendMoney({ ...SEND, isOnline: false })
    expect(result.ok).toBe(false)
  })
})

describe('sendMoney online', () => {
  it('asks Leafy Pay first, then writes the real reference to the device', async () => {
    psp.sendToBeneficiary.mockResolvedValue({ reference: 'lp-real-1', status: 'completed' })

    const result = await sendMoney(SEND)

    expect(psp.sendToBeneficiary).toHaveBeenCalledOnce()
    expect(local.createLocalTransaction).toHaveBeenCalledOnce()
    expect(local.createLocalTransaction.mock.calls[0][0]).toMatchObject({
      leafyPayTransferReference: 'lp-real-1',
      leafyPayStatus: 'settled',
      localSyncStatus: 'synced',
    })
    expect(result).toMatchObject({ ok: true, reference: 'lp-real-1' })
  })

  it('never writes a stand-in reference to the synced collection', async () => {
    psp.sendToBeneficiary.mockResolvedValue({ reference: 'lp-real-2', status: 'pending' })
    await sendMoney(SEND)
    expect(local.createLocalTransaction.mock.calls[0][0].leafyPayTransferReference).not.toMatch(/^local-/)
  })

  it('leaves a pending transfer unsettled rather than stamping a settlement time', async () => {
    psp.sendToBeneficiary.mockResolvedValue({ reference: 'lp-real-3', status: 'pending' })
    await sendMoney(SEND)
    const written = local.createLocalTransaction.mock.calls[0][0]
    expect(written.leafyPayStatus).toBe('pending')
    expect(written.settledAt).toBe(0)
  })

  it('writes nothing when Leafy Pay rejects the transfer', async () => {
    psp.sendToBeneficiary.mockRejectedValue({ body: 'insufficient funds' })

    const result = await sendMoney(SEND)

    expect(local.createLocalTransaction).not.toHaveBeenCalled()
    expect(local.createPendingSend).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: false, error: 'insufficient funds' })
  })

  it('does not queue first, so a rejected payment leaves nothing behind to replay', async () => {
    psp.sendToBeneficiary.mockRejectedValue(new Error('network'))
    await sendMoney(SEND)
    expect(local.createPendingSend).not.toHaveBeenCalled()
  })

  it('rejects a missing recipient or non-positive amount before touching anything', async () => {
    for (const bad of [{ ...SEND, amount: 0 }, { ...SEND, counterpartyArrangementReference: '' }]) {
      expect((await sendMoney(bad)).ok).toBe(false)
    }
    expect(psp.sendToBeneficiary).not.toHaveBeenCalled()
    expect(local.createPendingSend).not.toHaveBeenCalled()
  })
})

describe('replayPendingSends', () => {
  it('settles each queued row and retires it in the same device write', async () => {
    local.listPendingSends.mockResolvedValue([
      { id: 7, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-1', amount: 5, note: 'a' },
    ])
    psp.sendToBeneficiary.mockResolvedValue({ reference: 'lp-replayed', status: 'completed' })

    const result = await replayPendingSends()

    // retirePendingSendId is what makes create-and-retire atomic.
    expect(local.createLocalTransaction.mock.calls[0][0]).toMatchObject({
      leafyPayTransferReference: 'lp-replayed',
      retirePendingSendId: 7,
    })
    expect(result).toMatchObject({ replayed: 1, failed: 0, references: ['lp-replayed'] })
  })

  it('keeps a row queued when Leafy Pay rejects it', async () => {
    local.listPendingSends.mockResolvedValue([
      { id: 8, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-1', amount: 5, note: '' },
    ])
    psp.sendToBeneficiary.mockRejectedValue(new Error('declined'))

    const result = await replayPendingSends()

    expect(local.createLocalTransaction).not.toHaveBeenCalled()
    expect(result).toMatchObject({ replayed: 0, failed: 1 })
  })

  it('settles one row per queued send', async () => {
    local.listPendingSends.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-1', amount: 1, note: '' },
      { id: 2, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-2', amount: 2, note: '' },
    ])
    psp.sendToBeneficiary.mockImplementation(async (ref) => ({ reference: `lp-${ref}`, status: 'completed' }))

    const result = await replayPendingSends()

    expect(psp.sendToBeneficiary).toHaveBeenCalledTimes(2)
    expect(local.createLocalTransaction.mock.calls.map((c) => c[0].retirePendingSendId)).toEqual([1, 2])
    expect(result.replayed).toBe(2)
  })

  it('does nothing when the queue is empty', async () => {
    local.listPendingSends.mockResolvedValue([])
    const result = await replayPendingSends()
    expect(psp.sendToBeneficiary).not.toHaveBeenCalled()
    expect(result).toMatchObject({ replayed: 0, failed: 0 })
  })
})
