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

/** Whether the on-device store is reachable. */
export async function isLocalStoreUp() {
  try {
    await call('GET', '/health')
    return true
  } catch {
    return false
  }
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

/** Payment requests held on device. Pass `targetDigest` for an inbox, `requesterPartyRef` for an outbox. */
export async function listLocalRequests({ targetDigest, requesterPartyRef, status } = {}) {
  const query = new URLSearchParams({
    ...(targetDigest ? { targetDigest } : {}),
    ...(requesterPartyRef ? { requesterPartyRef } : {}),
    ...(status ? { status } : {}),
  }).toString()
  return call('GET', `/requests${query ? `?${query}` : ''}`)
}

/**
 * Raise a request while offline. Needs no replay — Sync carrying it to Atlas is the delivery.
 * @param {object} request - `{ requestReference, requesterPartyRef, requesterName, requesterDigest, targetDigest, amount, currency, note }`.
 */
export async function createLocalRequest(request) {
  return call('POST', '/requests', request)
}

/** Resolve a local request by its ObjectBox id. Rejects a replay with 409. */
export async function resolveLocalRequest(id, { status, leafyPayTransferReference }) {
  return call('PUT', `/requests/${encodeURIComponent(id)}`, {
    status,
    ...(leafyPayTransferReference ? { leafyPayTransferReference } : {}),
  })
}
