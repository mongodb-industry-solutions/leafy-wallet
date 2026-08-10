import { describe, it, expect, vi, beforeEach } from 'vitest'

// Reconcile is the only code that deletes wallet data, and a wrong filter deletes it silently. These
// cover which rows it considers orphaned, which it must leave alone, and what it adopts.
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
const { reconcileWithLeafyPay } = await import('@/lib/wallet/actions')

const deletedTxIds = () => local.deleteLocalTransaction.mock.calls.map((c) => c[0])
const adoptedRefs = () =>
  local.createLocalTransaction.mock.calls.map((c) => c[0].leafyPayTransferReference)

beforeEach(() => {
  vi.clearAllMocks()
  psp.listTransactions.mockResolvedValue([])
  psp.listBeneficiaries.mockResolvedValue([])
  psp.listRtpRequests.mockResolvedValue([])
  local.listLocalTransactions.mockResolvedValue([])
  local.listLocalContacts.mockResolvedValue([])
  local.listLocalRequests.mockResolvedValue([])
})

describe('reconcile pruning', () => {
  it('deletes a device transaction Leafy Pay no longer reports', async () => {
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', leafyPayTransferReference: 'gone' },
    ])

    const result = await reconcileWithLeafyPay()

    expect(deletedTxIds()).toEqual([1])
    expect(result.prunedTransactions).toBe(1)
  })

  it('keeps a transaction Leafy Pay still reports', async () => {
    psp.listTransactions.mockResolvedValue([
      { reference: 'kept', value: 10, currency: 'EUR', direction: 'sent', status: 'completed' },
    ])
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', leafyPayTransferReference: 'kept' },
    ])

    await reconcileWithLeafyPay()

    expect(local.deleteLocalTransaction).not.toHaveBeenCalled()
  })

  it('never touches another owner’s rows', async () => {
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'someone-else', leafyPayTransferReference: 'not-mine' },
    ])
    local.listLocalContacts.mockResolvedValue([
      { id: 2, ownerPartyRef: 'someone-else', counterpartyArrangementReference: 'their-cp' },
    ])

    const result = await reconcileWithLeafyPay()

    expect(local.deleteLocalTransaction).not.toHaveBeenCalled()
    expect(local.deleteLocalContact).not.toHaveBeenCalled()
    expect(result).toMatchObject({ prunedTransactions: 0, prunedContacts: 0 })
  })

  it('spares a request settlement, which is absent from Leafy Pay’s transfer history', async () => {
    psp.listRtpRequests.mockResolvedValue([
      { reference: 'req-1', executionReference: 'settled-by-request', amount: 5, currency: 'EUR' },
    ])
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', leafyPayTransferReference: 'settled-by-request' },
    ])

    await reconcileWithLeafyPay()

    expect(local.deleteLocalTransaction).not.toHaveBeenCalled()
  })

  it('spares a stand-in reference, which Leafy Pay has never seen', async () => {
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', leafyPayTransferReference: 'local-abc' },
    ])

    await reconcileWithLeafyPay()

    expect(local.deleteLocalTransaction).not.toHaveBeenCalled()
  })

  it('deletes a contact whose beneficiary is gone, and keeps one that remains', async () => {
    psp.listBeneficiaries.mockResolvedValue([{ reference: 'cp-kept', label: 'Kept' }])
    local.listLocalContacts.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-kept' },
      { id: 2, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-gone' },
    ])

    const result = await reconcileWithLeafyPay()

    expect(local.deleteLocalContact.mock.calls.map((c) => c[0])).toEqual([2])
    expect(result.prunedContacts).toBe(1)
  })

  it('deletes an orphaned request but keeps one queued on the device', async () => {
    local.listLocalRequests.mockResolvedValue([
      { id: 1, requestReference: 'gone', localSyncStatus: 'synced' },
      { id: 2, requestReference: 'local-pending-one', localSyncStatus: 'local_pending' },
    ])

    const result = await reconcileWithLeafyPay()

    expect(local.deleteLocalRequest.mock.calls.map((c) => c[0])).toEqual([1])
    expect(result.prunedRequests).toBe(1)
  })
})

describe('reconcile adoption', () => {
  it('adopts a transfer the device does not have, stamped with the signed-in owner', async () => {
    psp.listTransactions.mockResolvedValue([
      {
        reference: 'foreign-1',
        counterpartyReference: 'cp-9',
        value: -20,
        currency: 'EUR',
        direction: 'sent',
        status: 'completed',
      },
    ])

    const result = await reconcileWithLeafyPay()

    expect(local.createLocalTransaction).toHaveBeenCalledOnce()
    expect(local.createLocalTransaction.mock.calls[0][0]).toMatchObject({
      leafyPayTransferReference: 'foreign-1',
      ownerPartyRef: 'owner-1',
      amount: 20,
      leafyPayStatus: 'settled',
      localSyncStatus: 'synced',
    })
    expect(result.adoptedTransactions).toBe(1)
  })

  it('does not adopt a transfer the device already holds', async () => {
    psp.listTransactions.mockResolvedValue([
      { reference: 'known', value: 10, currency: 'EUR', direction: 'sent', status: 'completed' },
    ])
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', leafyPayTransferReference: 'known' },
    ])

    await reconcileWithLeafyPay()

    expect(local.createLocalTransaction).not.toHaveBeenCalled()
  })

  it('adopts an outgoing request payment the device is missing', async () => {
    psp.listRtpRequests.mockImplementation(async (box) =>
      box === 'outbox'
        ? [
            {
              reference: 'req-2',
              executionReference: 'exec-2',
              amount: 15,
              currency: 'EUR',
              status: 'payment_settled',
              payerCounterpartyRef: 'cp-3',
            },
          ]
        : [],
    )

    await reconcileWithLeafyPay()

    expect(adoptedRefs()).toContain('exec-2')
    const adopted = local.createLocalTransaction.mock.calls.find(
      (c) => c[0].leafyPayTransferReference === 'exec-2',
    )[0]
    expect(adopted).toMatchObject({ direction: 'received', leafyPayStatus: 'settled', amount: 15 })
  })

  it('does not adopt an incoming request, which only the payer records', async () => {
    psp.listRtpRequests.mockImplementation(async (box) =>
      box === 'inbox'
        ? [{ reference: 'req-3', executionReference: 'exec-3', amount: 9, currency: 'EUR' }]
        : [],
    )

    await reconcileWithLeafyPay()

    expect(adoptedRefs()).not.toContain('exec-3')
  })
})

describe('reconcile guards', () => {
  it('does nothing without a signed-in user', async () => {
    const session = await import('@/lib/auth/session')
    session.getSession.mockResolvedValueOnce(null)

    const result = await reconcileWithLeafyPay()

    expect(result).toEqual({ ok: false })
    expect(local.deleteLocalTransaction).not.toHaveBeenCalled()
  })

  it('prunes nothing when Leafy Pay and the device already agree', async () => {
    psp.listTransactions.mockResolvedValue([
      { reference: 'a', value: 1, currency: 'EUR', direction: 'sent', status: 'completed' },
    ])
    psp.listBeneficiaries.mockResolvedValue([{ reference: 'cp-1', label: 'C' }])
    local.listLocalTransactions.mockResolvedValue([
      { id: 1, ownerPartyRef: 'owner-1', leafyPayTransferReference: 'a' },
    ])
    local.listLocalContacts.mockResolvedValue([
      { id: 2, ownerPartyRef: 'owner-1', counterpartyArrangementReference: 'cp-1' },
    ])

    const result = await reconcileWithLeafyPay()

    expect(result).toMatchObject({
      ok: true,
      prunedTransactions: 0,
      prunedContacts: 0,
      prunedRequests: 0,
      adoptedTransactions: 0,
    })
  })
})
