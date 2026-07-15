import 'server-only'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

async function backendGet(path) {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`backend request failed: ${res.status}`)
  return res.json()
}

async function backendPost(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
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
