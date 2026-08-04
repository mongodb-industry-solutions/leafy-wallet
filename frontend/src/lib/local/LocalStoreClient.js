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

/** Contacts held on device, synced down from Atlas. */
export async function listLocalContacts() {
  return call('GET', '/contacts')
}

/** Transactions held on device, including sends queued while offline (`local_pending`). */
export async function listLocalTransactions() {
  return call('GET', '/transactions')
}

/**
 * Semantic search over the device's transaction notes - ObjectBox's own HNSW index, no network.
 * @param {{q: string, ownerPartyRef?: string, limit?: number}} params
 */
export async function searchLocalTransactions({ q, ownerPartyRef, limit = 10 }) {
  const query = new URLSearchParams({
    q,
    ...(ownerPartyRef ? { ownerPartyRef } : {}),
    limit: String(limit),
  }).toString()
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
 * Queue a send while offline. The store stamps it `local_pending` and embeds the note; the caller
 * supplies the stand-in `leafyPayTransferReference`.
 * @param {object} send - `{ leafyPayTransferReference, ownerPartyRef, counterpartyArrangementReference, amount, currency, direction, note }`.
 */
export async function queueLocalSend(send) {
  return call('POST', '/transactions/send', send)
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
