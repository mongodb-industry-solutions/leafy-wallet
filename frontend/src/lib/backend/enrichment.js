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
 * Write the enrichment doc for a completed transfer. The backend embeds the note via Ollama.
 * @param {object} doc - `{ leafyPayTransferReference, ownerPartyRef, counterpartyArrangementReference, amount, note, direction, leafyPayStatus }`.
 */
/**
 * Update an enrichment doc.
 * @param {string} id - The Atlas id.
 * @param {object} patch - e.g. `{ leafyPayStatus, settledAt }`.
 */
export async function updateTransactionEnrichment(id, patch) {
  return backendPatch(`/api/v1/wallet-transactions/${encodeURIComponent(id)}`, patch)
}

export async function createTransactionEnrichment(doc) {
  return backendPost('/api/v1/wallet-transactions', doc)
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

/**
 * Pending payment requests addressed to a user. Leafy Pay has no concept of a request, so these
 * live only in Atlas; the target finds their own by digesting their session email.
 * @param {string} targetDigest - The blind index of the target's email (see lib/wallet/digest.js).
 */
export async function listIncomingRequests(targetDigest) {
  const query = new URLSearchParams({ targetDigest, status: 'pending' }).toString()
  return backendGet(`/api/v1/wallet-requests?${query}`)
}

/**
 * Payment requests a user has raised, in any state (their outbox).
 * @param {string} owner - The OAuth `sub` (requesterPartyRef).
 */
export async function listOutgoingRequests(owner) {
  const query = new URLSearchParams({ requesterPartyRef: owner }).toString()
  return backendGet(`/api/v1/wallet-requests?${query}`)
}

/**
 * Raise a payment request.
 * @param {object} doc - `{ requesterPartyRef, requesterName, requesterDigest, targetDigest, amount, currency, note }`.
 */
export async function createRequestDoc(doc) {
  return backendPost('/api/v1/wallet-requests', doc)
}

/**
 * Resolve a request. The backend rejects a second resolution, so a request can only settle once.
 * @param {string} id - The Atlas id.
 * @param {object} patch - `{ status, leafyPayTransferReference? }`.
 */
export async function resolveRequestDoc(id, patch) {
  return backendPatch(`/api/v1/wallet-requests/${encodeURIComponent(id)}`, patch)
}
