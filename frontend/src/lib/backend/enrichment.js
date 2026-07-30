import 'server-only'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

/** Mongo returns the primary key as `_id`; expose it as `id`, matching the local store. */
const withId = (doc) => (doc?._id ? { ...doc, id: doc._id } : doc)

async function backendGet(path) {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`backend request failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data.map(withId) : withId(data)
}

async function backendPost(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`backend request failed: ${res.status}`)
  return withId(await res.json())
}

async function backendPatch(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`backend request failed: ${res.status}`)
  return res.json()
}

async function backendDelete(path) {
  const res = await fetch(`${BACKEND_URL}${path}`, { method: 'DELETE', cache: 'no-store' })
  if (!res.ok) throw new Error(`backend request failed: ${res.status}`)
}

/**
 * Atlas enrichment for an owner's transactions (note + embedding), keyed by `leafyPayTransferReference`.
 * Leafy Pay owns the transfer itself; Atlas adds the free-text note and the semantic-search index.
 * @param {string} owner - The OAuth `sub` (ownerPartyRef).
 */
export async function listTransactionEnrichment(owner) {
  const query = new URLSearchParams({ ownerPartyRef: owner }).toString()
  return backendGet(`/api/v1/wallet-transactions?${query}`)
}

/**
 * Semantic search over an owner's transaction notes (Atlas `$vectorSearch`).
 * @param {{q: string, owner: string, limit?: number}} params
 */
export async function searchTransactionEnrichment({ q, owner, limit = 10 }) {
  const query = new URLSearchParams({ q, ownerPartyRef: owner, limit: String(limit) }).toString()
  return backendGet(`/api/v1/wallet-transactions/search?${query}`)
}

/**
 * Per-contact totals, largest first - computed by Atlas, not by summing rows here.
 * @param {{owner: string, direction?: 'sent'|'received'}} params
 */
export async function spendingByContactEnrichment({ owner, direction = 'sent' }) {
  const query = new URLSearchParams({ ownerPartyRef: owner, direction }).toString()
  return backendGet(`/api/v1/wallet-transactions/summary?${query}`)
}

/**
 * Update an enrichment doc.
 * @param {string} id - The Atlas id.
 * @param {object} patch - e.g. `{ leafyPayStatus, settledAt }`.
 */
export async function updateTransactionEnrichment(id, patch) {
  return backendPatch(`/api/v1/wallet-transactions/${encodeURIComponent(id)}`, patch)
}

/**
 * Write the enrichment doc for a completed transfer. The backend embeds the note via Ollama.
 * @param {object} doc - `{ leafyPayTransferReference, ownerPartyRef, counterpartyArrangementReference, amount, note, direction, leafyPayStatus }`.
 */
export async function createTransactionEnrichment(doc) {
  return backendPost('/api/v1/wallet-transactions', doc)
}

/** Delete an enrichment doc whose transfer no longer exists in Leafy Pay. */
export async function deleteTransactionEnrichment(id) {
  return backendDelete(`/api/v1/wallet-transactions/${encodeURIComponent(id)}`)
}

/**
 * The Atlas `walletContacts` replica for an owner (the offline copy of their saved beneficiaries).
 * @param {string} owner - The OAuth `sub` (ownerPartyRef).
 */
export async function listContactEnrichment(owner) {
  const query = new URLSearchParams({ ownerPartyRef: owner }).toString()
  return backendGet(`/api/v1/wallet-contacts?${query}`)
}

/**
 * Write the replica doc for a saved contact.
 * @param {object} doc - `{ ownerPartyRef, counterpartyArrangementReference, counterpartyLabel, counterpartyLookupType, counterpartyLookupHint }`.
 */
export async function createContactEnrichment(doc) {
  return backendPost('/api/v1/wallet-contacts', doc)
}

/** Remove a replica doc by its Atlas id. */
export async function deleteContactEnrichment(id) {
  return backendDelete(`/api/v1/wallet-contacts/${encodeURIComponent(id)}`)
}

/** An owner's chats, newest first. */
export async function listChatDocs(owner) {
  const query = new URLSearchParams({ ownerPartyRef: owner }).toString()
  return backendGet(`/api/v1/chats?${query}`)
}

/** Start a chat. The server mints its `chatReference`. */
export async function createChatDoc({ owner, title }) {
  return backendPost('/api/v1/chats', { ownerPartyRef: owner, title })
}

/** Delete a chat; the server cascades to its messages. */
export async function deleteChatDoc(chatId) {
  return backendDelete(`/api/v1/chats/${encodeURIComponent(chatId)}`)
}

/** A chat's messages, oldest first. */
export async function listChatMessageDocs(chatReference) {
  const query = new URLSearchParams({ chatReference }).toString()
  return backendGet(`/api/v1/chat-messages?${query}`)
}

/** Append a message. The server embeds the text for later retrieval. */
export async function createChatMessageDoc({ chatId, chatReference, role, text }) {
  return backendPost('/api/v1/chat-messages', { chatId, chatReference, role, text })
}

/**
 * The Atlas `walletRequests` replica for a user: requests they raised (`requesterPartyRef`) or are
 * asked to pay (`payerPartyRef`). Leafy Pay owns the requests themselves; this copy exists so they
 * can be read on the device with no connection.
 * @param {{requesterPartyRef?: string, payerPartyRef?: string}} filter
 */
export async function listRequestDocs(filter) {
  const query = new URLSearchParams(filter).toString()
  return backendGet(`/api/v1/wallet-requests?${query}`)
}

/**
 * Mirror one Leafy Pay request into Atlas. Keyed by `requestReference`, so re-reading a request
 * converges onto the same doc instead of duplicating it.
 * @param {object} doc - `{ requestReference, requesterPartyRef, requesterName, payerPartyRef, payerCounterpartyRef, amount, currency, note, status, localSyncStatus, leafyPayTransferReference, createdAt, resolvedAt }`.
 */
export async function upsertRequestDoc(doc) {
  return backendPost('/api/v1/wallet-requests', doc)
}

/** Delete a replica whose request no longer exists in Leafy Pay. */
export async function deleteRequestDoc(id) {
  return backendDelete(`/api/v1/wallet-requests/${encodeURIComponent(id)}`)
}
