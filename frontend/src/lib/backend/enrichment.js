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
 * Hybrid search over an owner's transaction history: Atlas `$rankFusion` blends semantic and exact-term
 * matches, so a reference like "INV-2291" is findable even though it has no useful embedding.
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
 * The Atlas `walletContacts` replica for an owner (the offline copy of their saved beneficiaries).
 * @param {string} owner - The OAuth `sub` (ownerPartyRef).
 */
export async function listContactEnrichment(owner) {
  const query = new URLSearchParams({ ownerPartyRef: owner }).toString()
  return backendGet(`/api/v1/wallet-contacts?${query}`)
}
