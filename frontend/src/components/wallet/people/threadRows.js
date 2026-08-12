import { toActivityRows } from '@/lib/wallet/requests'

/**
 * Everything that has passed between the user and one contact, oldest first so it reads as a
 * conversation. Built from the same rows the Activity tab shows, so a payment made offline sits in
 * the thread the moment it is queued.
 * @param {object[]} [transactions] - Rows from `getTransactions`.
 * @param {object[]} [outgoingRequests] - Outgoing request views from `getRequests`.
 * @param {string} [contactRef] - The contact's Leafy Pay arrangement reference.
 * @returns {object[]} Rows in chat order.
 */
export function threadRows(transactions, outgoingRequests, contactRef) {
  if (!contactRef) return []
  return toActivityRows(transactions, outgoingRequests)
    .filter((row) => row.counterpartyRef === contactRef)
    .reverse()
}
