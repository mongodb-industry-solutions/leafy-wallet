import 'server-only'

const LOCAL_STORE_URL = process.env.LOCAL_STORE_URL ?? 'http://localhost:8090'

async function call(method, path, body) {
  const res = await fetch(`${LOCAL_STORE_URL}/local/v1${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`local store request failed: ${res.status}`)
  return res.status === 204 ? null : res.json()
}

/** Cached account balances. Local-only: this entity never syncs, so `cacheAccount` populates it. */
export async function listLocalAccounts() {
  return call('GET', '/accounts')
}

/**
 * Write an account's balance into the on-device cache so it survives going offline.
 * @param {object} account - `{ reference, ownerPartyRef, label, currency, balanceValue, maskedIban, isDefault }`.
 */
export async function cacheAccount({ reference, ownerPartyRef, label, currency, balanceValue, maskedIban, isDefault }) {
  return call('PUT', `/accounts/${encodeURIComponent(reference)}`, {
    ownerPartyRef,
    label,
    currency,
    balanceValue,
    maskedIban,
    isDefault,
  })
}

/** Contacts held on device. */
export async function listLocalContacts() {
  return call('GET', '/contacts')
}

/**
 * Save a contact on the device for Sync to carry up.
 * @param {object} contact - `{ ownerPartyRef, counterpartyArrangementReference, counterpartyLabel, counterpartyLookupType, counterpartyLookupHint }`.
 */
export async function createLocalContact(contact) {
  return call('POST', '/contacts', contact)
}

/** Transactions held on device, including sends queued while offline (`local_pending`). */
export async function listLocalTransactions() {
  return call('GET', '/transactions')
}

/**
 * Semantic search over the device's transaction notes - ObjectBox's own HNSW index, no network.
 * @param {{q: string, ownerPartyRef: string, limit?: number}} params
 */
export async function searchLocalTransactions({ q, ownerPartyRef, limit = 10 }) {
  const query = new URLSearchParams({ q, ownerPartyRef, limit: String(limit) }).toString()
  return call('GET', `/transactions/search?${query}`)
}

/**
 * Per-contact totals held on the device.
 * @param {{ownerPartyRef: string, direction?: 'sent'|'received'}} params
 */
export async function localSpendingByContact({ ownerPartyRef, direction = 'sent' }) {
  const query = new URLSearchParams({
    ...(ownerPartyRef ? { ownerPartyRef } : {}),
    direction,
  }).toString()
  return call('GET', `/transactions/summary?${query}`)
}

/**
 * Write a transaction to the device for Sync to carry up, once Leafy Pay has accepted it. Pass
 * `retirePendingSendId` to drop its queue row in the same device transaction.
 * @param {object} tx - `{ leafyPayTransferReference, ownerPartyRef, counterpartyArrangementReference, amount, currency, direction, note, leafyPayStatus, localSyncStatus, settledAt, retirePendingSendId }`.
 */
export async function createLocalTransaction(tx) {
  return call('POST', '/transactions/send', tx)
}

/**
 * Sends Leafy Pay hasn't accepted yet. Local-only, so these never reach Atlas. Pass `deviceRef` to
 * get only this browser's queue: two attendees on the same demo user share an `ownerPartyRef`.
 * @param {string} [ownerPartyRef]
 * @param {string} [deviceRef]
 */
export async function listPendingSends(ownerPartyRef, deviceRef) {
  const params = new URLSearchParams({
    ...(ownerPartyRef ? { ownerPartyRef } : {}),
    ...(deviceRef ? { deviceRef } : {}),
  }).toString()
  return call('GET', `/pending-sends${params ? `?${params}` : ''}`)
}

/**
 * Queue a send with no `leafyPayTransferReference` - there isn't one until Leafy Pay accepts it,
 * which is why this row is kept out of the synced collection.
 * @param {object} send - `{ ownerPartyRef, deviceRef, counterpartyArrangementReference, amount, currency, direction, note }`.
 */
export async function createPendingSend(send) {
  return call('POST', '/pending-sends', send)
}

/**
 * Update a transaction in place, so the change syncs up on the row that already exists.
 * @param {number} id
 * @param {{leafyPayTransferReference?: string, leafyPayStatus?: string, localSyncStatus?: string, settledAt?: number}} fields
 */
export async function updateLocalTransaction(id, fields) {
  return call('PATCH', `/transactions/${encodeURIComponent(id)}`, fields)
}

/** Drop a local transaction. Propagates through Sync. */
export async function deleteLocalTransaction(id) {
  return call('DELETE', `/transactions/${encodeURIComponent(id)}`)
}

/** Chats held on device. */
export async function listLocalChats(ownerPartyRef) {
  const query = ownerPartyRef ? `?${new URLSearchParams({ ownerPartyRef })}` : ''
  return call('GET', `/chats${query}`)
}

/** Start a chat on device. The caller mints `chatReference` - there's no server here to do it. */
export async function createLocalChat({ ownerPartyRef, chatReference, title }) {
  return call('POST', '/chats', { ownerPartyRef, chatReference, title })
}

/** Delete a chat held on device; the store removes its messages with it. */
export async function deleteLocalChat(chatReference) {
  return call('DELETE', `/chats/${encodeURIComponent(chatReference)}`)
}

/** A chat's messages held on device, oldest first. */
export async function listLocalChatMessages(chatReference) {
  return call('GET', `/chats/${encodeURIComponent(chatReference)}/messages`)
}

/** Append a message on device. The store embeds the text via Ollama. */
export async function createLocalChatMessage(chatReference, { role, text }) {
  return call('POST', `/chats/${encodeURIComponent(chatReference)}/messages`, { role, text })
}

/**
 * Payment requests held on device, synced down from Atlas. Pass `payerPartyRef` for an inbox,
 * `requesterPartyRef` for an outbox, `localSyncStatus` to find the ones queued while offline.
 */
export async function listLocalRequests({ payerPartyRef, requesterPartyRef, localSyncStatus } = {}) {
  const query = new URLSearchParams({
    ...(payerPartyRef ? { payerPartyRef } : {}),
    ...(requesterPartyRef ? { requesterPartyRef } : {}),
    ...(localSyncStatus ? { localSyncStatus } : {}),
  }).toString()
  return call('GET', `/requests${query ? `?${query}` : ''}`)
}

/**
 * Queue a request raised while offline. The store stamps it `local_pending`; the caller supplies the
 * stand-in `requestReference`, which the replay swaps for Leafy Pay's once there's a connection.
 * @param {object} request - `{ requestReference, requesterPartyRef, requesterName, payerCounterpartyRef, amount, currency, note }`.
 */
export async function createLocalRequest(request) {
  return call('POST', '/requests', request)
}

/**
 * Record what Leafy Pay reports about a request; it owns the lifecycle.
 * @param {number} id
 * @param {{status?: string, localSyncStatus?: string, payerPartyRef?: string, requesterPartyRef?: string, leafyPayTransferReference?: string, resolvedAt?: number}} fields
 */
export async function updateLocalRequest(id, fields) {
  return call('PATCH', `/requests/${encodeURIComponent(id)}`, fields)
}

/** Drop a contact from the device. Propagates through Sync. */
export async function deleteLocalContact(id) {
  return call('DELETE', `/contacts/${encodeURIComponent(id)}`)
}

/** Drop a queued request once Leafy Pay holds the real one. Propagates through Sync. */
export async function deleteLocalRequest(id) {
  return call('DELETE', `/requests/${encodeURIComponent(id)}`)
}

/** Stop the on-device ObjectBox Sync connection so "going offline" severs sync for real. */
export async function pauseLocalSync() {
  return call('POST', '/sync/pause')
}

/** Resume the on-device ObjectBox Sync connection; queued local writes replay to Atlas. */
export async function resumeLocalSync() {
  return call('POST', '/sync/resume')
}
