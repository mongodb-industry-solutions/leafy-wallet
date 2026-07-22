// Leafy Pay models a payment request in sixteen states; the wallet renders five. This is the single
// place the two vocabularies meet.

// Still with the payer: nothing has been decided, so the request is payable and declinable.
const AWAITING_PAYER = ['draft', 'created', 'validated', 'presented', 'delivered', 'viewed']

// The payer approved. A later reversal is the payment's story, not the request's.
const ANSWERED = [
  'accepted',
  'payment_initiated',
  'payment_processing',
  'payment_settled',
  'reversed',
  'disputed',
]

const BY_STATUS = {
  rejected: 'declined',
  cancelled: 'cancelled',
  expired: 'expired',
  payment_failed: 'failed',
}

/**
 * Whether a request is still waiting on the payer. The authority for the Pay/Decline controls, so an
 * unrecognized status is never treated as actionable.
 * @param {string} pspStatus
 * @returns {boolean}
 */
export function isAwaitingPayer(pspStatus) {
  return AWAITING_PAYER.includes(pspStatus)
}

/**
 * Collapse a Leafy Pay request status into the one the UI renders.
 * @param {string} pspStatus
 * @returns {'pending'|'paid'|'declined'|'cancelled'|'expired'|'failed'}
 */
export function toRequestStatus(pspStatus) {
  if (isAwaitingPayer(pspStatus)) return 'pending'
  if (ANSWERED.includes(pspStatus)) return 'paid'
  return BY_STATUS[pspStatus] ?? 'pending'
}

/**
 * Rows for money the user has asked for and not been paid yet, so it sits inline with the payments
 * instead of in its own section. `kind` is what makes the row read as awaiting payment and the
 * detail sheet offer to cancel; nothing has moved, so the amount carries no direction.
 * @param {object[]} outgoing - Request views from `getRequests`.
 * @returns {object[]} Rows the activity lists render alongside transactions.
 */
export function toAwaitingPaymentRows(outgoing) {
  return (outgoing ?? [])
    .filter((r) => r.status === 'pending')
    .map((r) => ({ ...r, kind: 'request', amount: Math.abs(r.amount), isPending: true }))
}

/**
 * Activity rows for requests that produced a payment: Leafy Pay's history leaves a request's
 * settlement out, so the money would otherwise move the balance with no row to show for it.
 * @param {object[]} requests - Normalized requests, each tagged `isIncoming` (the user is the payer).
 * @param {Set<string>} knownReferences - Transfer references Leafy Pay already reported.
 * @returns {object[]} Rows in the shape `getTransactions` builds its list from.
 */
export function toRequestPaymentRows(requests, knownReferences) {
  return requests
    .filter((r) => r.executionReference && !knownReferences.has(r.executionReference))
    .map((r) => ({
      reference: r.executionReference,
      // Only the payee holds a saved contact for the other side; the payer just gets the name.
      counterpartyRef: r.isIncoming ? null : r.payerCounterpartyRef || null,
      fallbackName: r.isIncoming ? r.payeeName : '',
      isReceived: !r.isIncoming,
      magnitude: Math.abs(r.amount),
      currency: r.currency,
      note: r.note,
      createdAt: r.updatedAt ?? r.createdAt,
      status: r.status === 'payment_settled' ? 'completed' : 'pending',
    }))
}
