'use server'

import { randomUUID } from 'crypto'
import { getSession } from '@/lib/auth/session'
import {
  createBeneficiary,
  listAccounts,
  listBeneficiaries,
  listTransactions,
  removeBeneficiary,
  sendToBeneficiary,
} from '@/lib/psp/PspClient'
import { classifyNotes, emojiForCategory } from '@/lib/wallet/categories'
import {
  createContactEnrichment,
  createRequestDoc,
  createTransactionEnrichment,
  deleteContactEnrichment,
  deleteTransactionEnrichment,
  listContactEnrichment,
  listIncomingRequests,
  listOutgoingRequests,
  createChatDoc,
  createChatMessageDoc,
  deleteChatDoc,
  listChatDocs,
  listChatMessageDocs,
  listTransactionEnrichment,
  resolveRequestDoc,
  searchTransactionEnrichment,
  spendingByContactEnrichment,
  updateTransactionEnrichment,
} from '@/lib/backend/enrichment'
import {
  cacheAccount,
  createLocalChat,
  createLocalChatMessage,
  createLocalRequest,
  deleteLocalChat,
  deleteLocalTransaction,
  listLocalAccounts,
  listLocalChatMessages,
  listLocalChats,
  listLocalContacts,
  listLocalRequests,
  listLocalTransactions,
  localSpendingByContact,
  queueLocalSend,
  resolveLocalRequest,
  searchLocalTransactions,
} from '@/lib/local/LocalStoreClient'
import { lookupDigest } from './digest'
import { avatarFor, formatDate, formatMoney } from './format'
import { DEMO_USERS } from '@/lib/demo-users'

// Demo-user avatars keyed by email blind index. A contact/transaction/request that resolves to a
// demo user then shows the same pinned illustration regardless of the alias the user saved it under
// (the name is editable, the email digest is stable).
let demoAvatarsByDigest = null
function demoAvatarByDigest(digest) {
  if (!digest) return undefined
  if (!demoAvatarsByDigest) {
    demoAvatarsByDigest = new Map(DEMO_USERS.map((u) => [lookupDigest(u.email), { seed: u.seed, bg: u.bg }]))
  }
  return demoAvatarsByDigest.get(digest)
}

// Backfilled contacts keep no digest and only a first-char-masked email hint ("p***@back.es"), so we
// fall back to matching that hint's (first local char + domain) against the demo users. Only matches
// when exactly one demo user fits, so it never guesses between two similar addresses.
function demoAvatarByHint(hint) {
  const at = hint?.indexOf('@') ?? -1
  if (at <= 0) return undefined // not an email hint (e.g. phone) or malformed
  const firstChar = hint[0].toLowerCase()
  const domain = hint.slice(at + 1).toLowerCase()
  const matches = DEMO_USERS.filter((u) => {
    const [local, dom] = u.email.toLowerCase().split('@')
    return local[0] === firstChar && dom === domain
  })
  return matches.length === 1 ? { seed: matches[0].seed, bg: matches[0].bg } : undefined
}

// Requests carry no hint and a digest that predates the current key, but `requesterName` is the
// requester's real profile name (not a user-editable local alias), so it's a reliable key here.
function demoAvatarByName(name) {
  const key = name?.trim().toLowerCase()
  const user = key ? DEMO_USERS.find((u) => u.name.toLowerCase() === key) : undefined
  return user ? { seed: user.seed, bg: user.bg } : undefined
}

async function ownerRef() {
  const session = await getSession()
  return session?.sub ?? null
}

/** Last 4 visible digits of a masked IBAN, for the account card. */
function last4Of(maskedIban) {
  const digits = String(maskedIban ?? '').replace(/\D/g, '')
  return digits.slice(-4) || '••••'
}

/** Shape an account into the UI view, from either source. */
function toAccountView(a) {
  return {
    reference: a.reference,
    label: a.label,
    currency: a.currency,
    maskedIban: a.maskedIban,
    last4: last4Of(a.maskedIban),
    amount: formatMoney(a.balanceValue),
    balanceValue: a.balanceValue,
    isDefault: a.isDefault,
  }
}

/**
 * The user's accounts (balance, masked IBAN, currency), UI-ready. The online read writes balances
 * through to the device cache, which never syncs and is the only offline source.
 * @param {boolean} [isOnline]
 */
export async function getAccounts(isOnline = true) {
  if (!isOnline) {
    const cached = await listLocalAccounts().catch(() => [])
    return (cached ?? []).map((a) =>
      toAccountView({
        reference: a.accountReference,
        label: a.label,
        currency: a.currency,
        maskedIban: a.maskedIban ?? '',
        balanceValue: a.balanceValue,
        isDefault: a.isDefault,
      }),
    )
  }

  const owner = await ownerRef()
  const accounts = await listAccounts()
  await Promise.all(
    accounts.map((a) =>
      cacheAccount({
        reference: a.reference,
        ownerPartyRef: owner ?? '',
        label: a.label,
        currency: a.currency,
        balanceValue: a.balanceValue,
        maskedIban: a.maskedIban ?? '',
        isDefault: Boolean(a.isDefault),
      }).catch(() => {}),
    ),
  )
  return accounts.map(toAccountView)
}

/** Shape a Leafy Pay beneficiary into the UI contact used across the app. */
function toContactView(b) {
  return {
    id: b.reference,
    reference: b.reference,
    name: b.label,
    lookupHint: b.lookupHint,
    ...(demoAvatarByDigest(b.lookupDigest) ?? demoAvatarByHint(b.lookupHint) ?? avatarFor(b.reference ?? b.label)),
  }
}

/**
 * Resolve the user's contacts: Leafy Pay supplies the active set, Atlas supplies the alias. A
 * beneficiary missing from Atlas is backfilled; the Leafy Pay label is only a seed.
 */
async function resolveContacts(owner, { backfill = false } = {}) {
  const [beneficiaries, enrichment] = await Promise.all([
    listBeneficiaries().catch(() => []),
    owner ? listContactEnrichment(owner).catch(() => []) : [],
  ])
  const atlasByRef = new Map((enrichment ?? []).map((e) => [e.counterpartyArrangementReference, e]))

  if (backfill && owner) {
    const missing = beneficiaries.filter((b) => !atlasByRef.has(b.reference))
    await Promise.all(
      missing.map((b) =>
        createContactEnrichment({
          ownerPartyRef: owner,
          counterpartyArrangementReference: b.reference,
          counterpartyLabel: b.label,
          counterpartyLookupType: b.lookupType,
          counterpartyLookupHint: b.lookupHint,
        })
          .then((doc) => atlasByRef.set(b.reference, doc))
          .catch(() => {}),
      ),
    )
  }

  return beneficiaries.map((b) => {
    const atlas = atlasByRef.get(b.reference)
    return {
      reference: b.reference,
      label: atlas?.counterpartyLabel || b.label,
      lookupType: atlas?.counterpartyLookupType || b.lookupType,
      lookupHint: atlas?.counterpartyLookupHint || b.lookupHint,
      lookupDigest: atlas?.counterpartyLookupDigest ?? null,
    }
  })
}

/** Contacts held on the device, synced down from Atlas. The only source when offline. */
async function localContacts(owner) {
  const contacts = await listLocalContacts().catch(() => [])
  return (contacts ?? [])
    .filter((c) => !owner || c.ownerPartyRef === owner)
    .map((c) => ({
      reference: c.counterpartyArrangementReference,
      label: c.counterpartyLabel,
      lookupType: c.counterpartyLookupType,
      lookupHint: c.counterpartyLookupHint,
      lookupDigest: c.counterpartyLookupDigest ?? null,
    }))
}

/**
 * The user's contacts, UI-ready. Names resolve from Atlas; Leafy Pay supplies refs + masks.
 * @param {boolean} [isOnline]
 */
export async function getContacts(isOnline = true) {
  const owner = await ownerRef()
  const contacts = isOnline
    ? await resolveContacts(owner, { backfill: true })
    : await localContacts(owner)
  return contacts.map(toContactView)
}

/**
 * Add a contact: resolve a registered Leafy Pay email into a saved beneficiary (source of truth),
 * then mirror it to the Atlas walletContacts replica. Fails cleanly if no registered user/merchant
 * matches the given email.
 *
 * The only moment we hold the address, so the blind index is derived here and the address discarded.
 * @param {{lookupValue: string, label?: string}} input
 * @returns {Promise<{ok: boolean, contact?: object, error?: string}>}
 */
export async function addContact({ lookupValue, label = '' } = {}) {
  const value = String(lookupValue ?? '').trim()
  if (!value) return { ok: false, error: 'Enter an email' }

  let result
  try {
    result = await createBeneficiary({ lookupType: 'email', lookupValue: value, label: label.trim() })
  } catch {
    return { ok: false, error: 'Could not add contact. Please try again.' }
  }
  if (!result.found) {
    return { ok: false, error: 'No Leafy Pay user is registered with that email.' }
  }
  const beneficiary = result.beneficiary
  const digest = lookupDigest(value)

  const owner = await ownerRef()
  if (owner) {
    try {
      await createContactEnrichment({
        ownerPartyRef: owner,
        counterpartyArrangementReference: beneficiary.reference,
        counterpartyLabel: beneficiary.label,
        counterpartyLookupType: beneficiary.lookupType,
        counterpartyLookupHint: beneficiary.lookupHint,
        counterpartyLookupDigest: digest,
      })
    } catch {
      return { ok: false, error: 'Could not save the contact - is the backend running?' }
    }
  }

  return { ok: true, contact: toContactView({ ...beneficiary, lookupDigest: digest }) }
}

/**
 * Remove a saved contact from Leafy Pay, then drop its Atlas replica doc (best-effort).
 * @param {string} reference - The counterpartyArrangementReference.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function removeContact(reference) {
  if (!reference) return { ok: false, error: 'Missing contact' }
  try {
    await removeBeneficiary(reference)
  } catch {
    return { ok: false, error: 'Could not remove contact. Please try again.' }
  }

  const owner = await ownerRef()
  if (owner) {
    try {
      const docs = await listContactEnrichment(owner)
      const match = (docs ?? []).find((d) => d.counterpartyArrangementReference === reference)
      if (match?.id) await deleteContactEnrichment(match.id)
    } catch {
      /* best-effort: the beneficiary is already gone from the source of truth */
    }
  }

  return { ok: true }
}

// Leafy Pay stamps this on a P2P transfer that was sent without a note; treated here as "no note".
const DEFAULT_REMITTANCE = 'P2P transfer via beneficiary portal'

// A send buffered on the device, carrying a stand-in reference until the replay swaps in the real one.
const LOCAL_PENDING = 'local_pending'
const LOCAL_REFERENCE_PREFIX = 'local-'

// `walletTransactions.leafyPayStatus` for a transfer Leafy Pay reports as `completed`.
const SETTLED_STATUS = 'settled'

/** Shape one transaction row for the UI, from either source. */
function toTransactionRow({ reference, counterpartyRef, contact, isReceived, magnitude, currency, note, createdAt, status, isPending }) {
  return {
    id: reference,
    reference,
    name: contact?.label || 'Leafy Pay user',
    lookupHint: contact?.lookupHint || '',
    note: note || 'No note',
    amount: isReceived ? magnitude : -magnitude,
    currency,
    date: formatDate(createdAt),
    createdAt,
    status,
    isPending,
    ...(demoAvatarByDigest(contact?.lookupDigest) ?? demoAvatarByHint(contact?.lookupHint) ?? avatarFor(counterpartyRef ?? reference)),
  }
}

/** Transactions held on the device: synced down from Atlas, plus any send queued while offline. */
async function localTransactions(owner) {
  const [transactions, contacts] = await Promise.all([
    listLocalTransactions().catch(() => []),
    localContacts(owner),
  ])
  const contactByRef = new Map(contacts.map((c) => [c.reference, c]))

  const rows = (transactions ?? [])
    .filter((t) => !owner || t.ownerPartyRef === owner)
    .map((t) => {
      const createdAt = t.createdAt ? new Date(t.createdAt).toISOString() : null
      const status = t.leafyPayStatus === SETTLED_STATUS ? 'completed' : t.leafyPayStatus
      return toTransactionRow({
        reference: t.leafyPayTransferReference,
        counterpartyRef: t.counterpartyArrangementReference,
        contact: contactByRef.get(t.counterpartyArrangementReference),
        isReceived: t.direction === 'received',
        magnitude: Math.abs(t.amount),
        currency: t.currency,
        note: t.note,
        createdAt,
        status,
        isPending: status !== 'completed',
      })
    })
  rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
  return rows
}

/**
 * The user's transactions: Leafy Pay (base transfer, source of truth) read in parallel with the Atlas
 * enrichment (note) and the resolved contacts (Atlas aliases), merged by `leafyPayTransferReference`.
 * Every row gets a non-empty name and note. Sorted newest first.
 * @param {boolean} [isOnline]
 */
export async function getTransactions(isOnline = true) {
  const owner = await ownerRef()
  if (!isOnline) return localTransactions(owner)
  const [transactions, contacts, enrichment] = await Promise.all([
    listTransactions(),
    resolveContacts(owner),
    owner ? listTransactionEnrichment(owner).catch(() => []) : [],
  ])
  const contactByRef = new Map(contacts.map((c) => [c.reference, c]))
  const enrichByRef = new Map((enrichment ?? []).map((e) => [e.leafyPayTransferReference, e]))

  // Leafy Pay owns settlement, so any enrichment still marked pending against a completed transfer
  // is stale - settling can outlast the send flow's watcher.
  await Promise.all(
    transactions
      .filter((t) => {
        const enrich = enrichByRef.get(t.reference)
        return t.status === 'completed' && enrich?.id && enrich.leafyPayStatus !== SETTLED_STATUS
      })
      .map((t) =>
        updateTransactionEnrichment(enrichByRef.get(t.reference).id, {
          leafyPayStatus: SETTLED_STATUS,
          settledAt: t.createdAt ?? new Date().toISOString(),
        }).catch(() => {}),
      ),
  )

  const rows = transactions.map((t) => {
    const enrich = enrichByRef.get(t.reference)
    const counterpartyRef = t.counterpartyReference ?? enrich?.counterpartyArrangementReference ?? null
    const enteredNote = enrich?.note || (t.note && t.note !== DEFAULT_REMITTANCE ? t.note : '')
    return toTransactionRow({
      reference: t.reference,
      counterpartyRef,
      contact: contactByRef.get(counterpartyRef),
      isReceived: t.direction === 'received',
      magnitude: Math.abs(t.value),
      currency: t.currency,
      note: enteredNote,
      createdAt: t.createdAt,
      status: t.status,
      isPending: t.status !== 'completed',
    })
  })

  rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
  return rows
}

/**
 * Send a P2P transfer: Leafy Pay moves the money (base), then the note is written to Atlas in parallel
 * so it gets embedded for search. The Atlas write is best-effort (money already moved). `fromAccountReference`
 * picks the source account; omit it to let Leafy Pay use the default. Offline the send is buffered on
 * the device and replayed on reconnect (see `replayPendingSends`).
 * @param {{counterpartyArrangementReference: string, fromAccountReference?: string, amount: number, note?: string, isOnline?: boolean}} input
 * @returns {Promise<{ok: boolean, reference?: string, status?: string, error?: string}>}
 */
export async function sendMoney({
  counterpartyArrangementReference,
  fromAccountReference,
  amount,
  note = '',
  isOnline = true,
}) {
  if (!counterpartyArrangementReference || !(amount > 0)) {
    return { ok: false, error: 'A recipient and an amount are required' }
  }

  if (!isOnline) {
    const owner = await ownerRef()
    const reference = `${LOCAL_REFERENCE_PREFIX}${randomUUID()}`
    try {
      await queueLocalSend({
        leafyPayTransferReference: reference,
        ownerPartyRef: owner ?? '',
        counterpartyArrangementReference,
        amount,
        currency: 'EUR',
        direction: 'sent',
        note: note || '',
      })
      return { ok: true, reference, status: LOCAL_PENDING }
    } catch {
      return { ok: false, error: 'Could not queue the payment on this device.' }
    }
  }

  let transfer
  try {
    transfer = await sendToBeneficiary(counterpartyArrangementReference, {
      amount,
      note,
      fromAccountRef: fromAccountReference,
    })
  } catch (e) {
    return { ok: false, error: e?.body || 'Transfer failed. Please try again.' }
  }

  const owner = await ownerRef()
  if (transfer.reference && owner) {
    try {
      await createTransactionEnrichment({
        leafyPayTransferReference: transfer.reference,
        ownerPartyRef: owner,
        counterpartyArrangementReference,
        amount,
        currency: 'EUR',
        note: note || null,
        direction: 'sent',
        leafyPayStatus: transfer.status === 'completed' ? SETTLED_STATUS : 'pending',
      })
    } catch {
      return { ok: false, error: 'Payment sent, but saving it failed - is the backend running?' }
    }
  }

  return { ok: true, reference: transfer.reference, status: transfer.status }
}

/**
 * Settlement status of a sent transfer, read from the transaction list (the dedicated status endpoint is
 * session-only, so we resolve it from the OAuth-visible transactions). `pending` while still settling.
 * @param {string} reference - The transfer reference returned by `sendMoney`.
 * @returns {Promise<{status: 'completed'|'pending'|'failed'|'unknown'}>}
 */
export async function getTransferStatus(reference) {
  if (!reference) return { status: 'unknown' }
  const transactions = await listTransactions()
  const match = transactions.find((t) => t.reference === reference)
  if (!match) return { status: 'pending' }
  if (match.status === 'completed') return { status: 'completed' }
  if (match.status === 'failed' || match.status === 'exception') return { status: 'failed' }
  return { status: 'pending' }
}

/**
 * Record a transfer's settlement in Atlas; Leafy Pay is the only source of settlement status.
 * @param {string} reference - The `leafyPayTransferReference`.
 * @param {'completed'|'failed'} status
 */
export async function markTransferSettled(reference, status) {
  const owner = await ownerRef()
  if (!owner || !reference) return
  try {
    const docs = await listTransactionEnrichment(owner)
    const match = (docs ?? []).find((d) => d.leafyPayTransferReference === reference)
    if (!match?.id) return
    await updateTransactionEnrichment(match.id, {
      leafyPayStatus: status === 'completed' ? SETTLED_STATUS : 'failed',
      settledAt: new Date().toISOString(),
    })
  } catch {
    // Non-fatal: Leafy Pay still has the status, and a later poll retries.
  }
}

/**
 * Send each `local_pending` transaction for real, then drop the local record - its deletion
 * propagates through Sync, clearing the placeholder from Atlas too. A failed replay keeps its
 * record for the next reconnect. Returns the new references, which the caller watches to settlement.
 * @returns {Promise<{replayed: number, failed: number, references: string[]}>}
 */
export async function replayPendingSends() {
  const owner = await ownerRef()
  const transactions = await listLocalTransactions().catch(() => [])
  const pending = (transactions ?? []).filter(
    (t) => t.localSyncStatus === LOCAL_PENDING && (!owner || t.ownerPartyRef === owner),
  )

  let replayed = 0
  let failed = 0
  const references = []
  for (const t of pending) {
    const sent = await sendMoney({
      counterpartyArrangementReference: t.counterpartyArrangementReference,
      amount: t.amount,
      note: t.note || '',
    })
    if (!sent.ok) {
      failed += 1
      continue
    }
    if (sent.reference) references.push(sent.reference)
    try {
      await deleteLocalTransaction(t.id)
      replayed += 1
    } catch {
      // The transfer went through; a stale local copy beats risking a double send, so leave it.
      failed += 1
    }
  }
  return { replayed, failed, references }
}

const toEnrichmentStatus = (status) => {
  if (status === 'completed') return SETTLED_STATUS
  if (status === 'failed' || status === 'exception') return status
  return 'pending'
}

/**
 * Converge the enrichment stores to Leafy Pay for the signed-in user. Leafy Pay is the source
 * of truth for money and beneficiaries: Atlas rows whose transfer or beneficiary no longer
 * exists there are orphans and get pruned, and transfers Leafy Pay has that the app never saw
 * (made elsewhere, or received) are adopted with a bare enrichment doc so they exist offline
 * too. Both directions sync down to the device copy. Queued offline sends don't exist in
 * Leafy Pay yet and are never touched.
 * @returns {Promise<{ok: boolean, prunedTransactions?: number, prunedContacts?: number, adoptedTransactions?: number}>}
 */
export async function reconcileWithLeafyPay() {
  const owner = await ownerRef()
  if (!owner) return { ok: false }
  try {
    const [transfers, beneficiaries, txDocs, contactDocs] = await Promise.all([
      listTransactions(),
      listBeneficiaries(),
      listTransactionEnrichment(owner).catch(() => []),
      listContactEnrichment(owner).catch(() => []),
    ])
    const transferRefs = new Set(transfers.map((t) => t.reference))
    const beneficiaryRefs = new Set(beneficiaries.map((b) => b.reference))
    const enrichedRefs = new Set((txDocs ?? []).map((d) => d.leafyPayTransferReference))

    const orphanTransactions = (txDocs ?? []).filter(
      (d) =>
        !String(d.leafyPayTransferReference ?? '').startsWith(LOCAL_REFERENCE_PREFIX) &&
        !transferRefs.has(d.leafyPayTransferReference),
    )
    const orphanContacts = (contactDocs ?? []).filter(
      (d) => !beneficiaryRefs.has(d.counterpartyArrangementReference),
    )
    // Note stays empty on adoption: the transfer wasn't composed in this app, and Leafy Pay's
    // own note is portal boilerplate, not something worth embedding.
    const foreignTransfers = transfers.filter((t) => !enrichedRefs.has(t.reference))

    await Promise.all([
      ...orphanTransactions.map((d) => deleteTransactionEnrichment(d.id).catch(() => {})),
      ...orphanContacts.map((d) => deleteContactEnrichment(d.id).catch(() => {})),
      ...foreignTransfers.map((t) =>
        createTransactionEnrichment({
          leafyPayTransferReference: t.reference,
          ownerPartyRef: owner,
          counterpartyArrangementReference: t.counterpartyReference ?? '',
          amount: Math.abs(t.value),
          currency: t.currency,
          note: null,
          direction: t.direction,
          leafyPayStatus: toEnrichmentStatus(t.status),
        }).catch(() => {}),
      ),
    ])
    return {
      ok: true,
      prunedTransactions: orphanTransactions.length,
      prunedContacts: orphanContacts.length,
      adoptedTransactions: foreignTransfers.length,
    }
  } catch {
    return { ok: false }
  }
}

/**
 * Semantic search over the user's transaction notes, for the assistant.
 * @param {string} q - Natural language, matched by meaning against the note.
 * @param {boolean} [isOnline]
 * @param {number} [limit]
 * @returns {Promise<object[]>} Rows shaped like the Activity list.
 */
export async function searchTransactions(q, isOnline = true, limit = 10) {
  const owner = await ownerRef()
  if (!q?.trim() || !owner) return []

  const [hits, contacts] = await Promise.all([
    (isOnline
      ? searchTransactionEnrichment({ q, owner, limit })
      : searchLocalTransactions({ q, ownerPartyRef: owner, limit })
    ).catch(() => []),
    isOnline ? resolveContacts(owner) : localContacts(owner),
  ])
  const contactByRef = new Map(contacts.map((c) => [c.reference, c]))

  return (hits ?? []).map((t) => {
    const status = t.leafyPayStatus === SETTLED_STATUS ? 'completed' : t.leafyPayStatus
    return toTransactionRow({
      reference: t.leafyPayTransferReference,
      counterpartyRef: t.counterpartyArrangementReference,
      contact: contactByRef.get(t.counterpartyArrangementReference),
      isReceived: t.direction === 'received',
      magnitude: Math.abs(t.amount),
      currency: t.currency,
      note: t.note,
      createdAt: typeof t.createdAt === 'number' ? new Date(t.createdAt).toISOString() : t.createdAt,
      status,
      isPending: status !== 'completed',
    })
  })
}

/**
 * Total sent to (or received from) each contact, largest first. The store does the arithmetic.
 * @param {boolean} [isOnline]
 * @param {'sent'|'received'} [direction]
 * @returns {Promise<{contact: string, total: number, count: number, currency: string}[]>}
 */
export async function getSpendingByContact(isOnline = true, direction = 'sent') {
  const owner = await ownerRef()
  if (!owner) return []

  const [rows, contacts] = await Promise.all([
    (isOnline
      ? spendingByContactEnrichment({ owner, direction })
      : localSpendingByContact({ ownerPartyRef: owner, direction })
    ).catch(() => []),
    isOnline ? resolveContacts(owner) : localContacts(owner),
  ])
  const labelByRef = new Map(contacts.map((c) => [c.reference, c.label]))

  return (rows ?? []).map((r) => ({
    contact: labelByRef.get(r.counterpartyArrangementReference) || 'Leafy Pay user',
    total: r.total,
    count: r.count,
    currency: r.currency,
  }))
}

/**
 * Spending grouped into categories (Dining, Bills, ...), largest first. Each outgoing payment's note
 * is matched to its nearest category by embedding similarity - the same vector model as note search,
 * so it works identically online and offline. Notes with no text fall under "Other".
 * @param {boolean} isOnline - Picks the transaction source; classification is the same either way.
 * @returns {Promise<{category: string, total: number, count: number, currency: string}[]>}
 */
export async function getSpendingByCategory(isOnline = true) {
  const spends = (await getTransactions(isOnline)).filter((t) => t.amount < 0)
  if (spends.length === 0) return []

  const categories = await classifyNotes(spends.map((t) => t.note))
  const totals = new Map()
  spends.forEach((t, i) => {
    const category = categories[i]
    const row =
      totals.get(category) ??
      { category, emoji: emojiForCategory(category), total: 0, count: 0, currency: t.currency }
    row.total += Math.abs(t.amount)
    row.count += 1
    totals.set(category, row)
  })
  return [...totals.values()]
    .map((r) => ({ ...r, total: Math.round(r.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Shape a stored request doc into the UI row used by the inbox and the bell. Keyed by
 * `requestReference`: Atlas keys by `_id` and the device by an ObjectBox integer, so it's the only
 * id that survives the connection dropping between reading a request and acting on it.
 */
function toRequestView(r) {
  const createdAt = typeof r.createdAt === 'number' ? new Date(r.createdAt).toISOString() : r.createdAt
  return {
    id: r.requestReference,
    reference: r.requestReference,
    name: r.requesterName,
    amount: r.amount,
    currency: r.currency,
    note: r.note || 'No note',
    status: r.status,
    date: formatDate(createdAt),
    createdAt,
    ...(demoAvatarByDigest(r.requesterDigest) ??
      demoAvatarByName(r.requesterName) ??
      avatarFor(r.requesterDigest ?? r.requestReference)),
  }
}

/**
 * Raise a payment request against a saved contact, addressed to its stored blind index. Leafy Pay
 * is not involved until the target pays.
 * @param {{counterpartyArrangementReference: string, amount: number, note?: string, isOnline?: boolean}} input
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function createRequest({ counterpartyArrangementReference, amount, note = '', isOnline = true }) {
  if (!counterpartyArrangementReference || !(amount > 0)) {
    return { ok: false, error: 'A contact and an amount are required' }
  }
  const session = await getSession()
  if (!session?.sub || !session?.email) return { ok: false, error: 'You need to be signed in' }

  const contacts = isOnline ? await resolveContacts(session.sub) : await localContacts(session.sub)
  const contact = contacts.find((c) => c.reference === counterpartyArrangementReference)
  if (!contact) return { ok: false, error: 'Contact not found' }
  if (!contact.lookupDigest) {
    return { ok: false, error: `You can only request from contacts added by email.` }
  }

  const request = {
    requesterPartyRef: session.sub,
    requesterName: session.name || session.email,
    requesterDigest: lookupDigest(session.email),
    targetDigest: contact.lookupDigest,
    amount,
    currency: 'EUR',
    note: note || null,
  }

  // No replay needed: Sync carrying the record to Atlas is the whole delivery.
  if (!isOnline) {
    try {
      await createLocalRequest({ ...request, requestReference: randomUUID() })
    } catch {
      return { ok: false, error: 'Could not save the request on this device.' }
    }
    return { ok: true }
  }

  try {
    await createRequestDoc(request)
  } catch {
    return { ok: false, error: 'Could not send the request - is the backend running?' }
  }
  return { ok: true }
}

/**
 * The user's payment requests: `incoming` are addressed to them (matched by digesting their own
 * session email), `outgoing` are ones they raised.
 * @param {boolean} [isOnline]
 * @returns {Promise<{incoming: object[], outgoing: object[]}>}
 */
export async function getRequests(isOnline = true) {
  const session = await getSession()
  if (!session?.sub || !session?.email) return { incoming: [], outgoing: [] }
  const digest = lookupDigest(session.email)

  const [incoming, outgoing] = isOnline
    ? await Promise.all([
        listIncomingRequests(digest).catch(() => []),
        listOutgoingRequests(session.sub).catch(() => []),
      ])
    : await Promise.all([
        listLocalRequests({ targetDigest: digest, status: 'pending' }).catch(() => []),
        listLocalRequests({ requesterPartyRef: session.sub }).catch(() => []),
      ])

  const sortNewestFirst = (rows) =>
    rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

  return {
    incoming: sortNewestFirst((incoming ?? []).map(toRequestView)),
    outgoing: sortNewestFirst((outgoing ?? []).map(toRequestView)),
  }
}

/**
 * Pay a request addressed to the user: match the requester's blind index against the user's own
 * contacts, send the transfer, then mark the request paid. Online only - the requester must already
 * be a saved contact, since Leafy Pay only accepts transfers against an arrangement the sender owns.
 * @param {string} reference - The `requestReference`.
 * @param {string} [fromAccountReference] - Source account; omit for the default.
 * @param {string} [noteOverride] - Replaces the request's note on the transfer (edited at review).
 * @returns {Promise<{ok: boolean, reference?: string, status?: string, error?: string}>}
 */
export async function payRequest(reference, fromAccountReference, noteOverride) {
  if (!reference) return { ok: false, error: 'Missing request' }
  const session = await getSession()
  if (!session?.sub || !session?.email) return { ok: false, error: 'You need to be signed in' }

  const incoming = await listIncomingRequests(lookupDigest(session.email)).catch(() => [])
  const request = (incoming ?? []).find((r) => r.requestReference === reference)
  if (!request) return { ok: false, error: 'This request is no longer pending' }

  const contacts = await resolveContacts(session.sub)
  const contact = contacts.find((c) => c.lookupDigest && c.lookupDigest === request.requesterDigest)
  if (!contact) {
    return { ok: false, error: `Add ${request.requesterName} as a contact to pay this request.` }
  }

  const sent = await sendMoney({
    counterpartyArrangementReference: contact.reference,
    fromAccountReference,
    amount: request.amount,
    note: noteOverride ?? (request.note || ''),
  })
  if (!sent.ok) return sent

  // The money has moved: never report failure, or the caller retries and pays twice.
  try {
    await resolveRequestDoc(request.id, { status: 'paid', leafyPayTransferReference: sent.reference })
  } catch {
    return {
      ok: true,
      reference: sent.reference,
      status: sent.status,
      warning: 'Payment sent, but the request could not be marked paid. Do not pay it again.',
    }
  }
  return { ok: true, reference: sent.reference, status: sent.status }
}

/**
 * Decline a request addressed to the user, or cancel one they raised.
 * @param {string} reference - The `requestReference`.
 * @param {'declined'|'cancelled'} status
 * @param {boolean} [isOnline]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function resolveRequest(reference, status, isOnline = true) {
  if (!reference) return { ok: false, error: 'Missing request' }
  const session = await getSession()
  if (!session?.sub || !session?.email) return { ok: false, error: 'You need to be signed in' }

  try {
    if (isOnline) {
      const digest = lookupDigest(session.email)
      const [incoming, outgoing] = await Promise.all([
        listIncomingRequests(digest),
        listOutgoingRequests(session.sub),
      ])
      const match = [...(incoming ?? []), ...(outgoing ?? [])].find((r) => r.requestReference === reference)
      if (!match) return { ok: false, error: 'This request is no longer pending' }
      await resolveRequestDoc(match.id, { status })
    } else {
      const local = await listLocalRequests({})
      const match = (local ?? []).find((r) => r.requestReference === reference)
      if (!match) return { ok: false, error: 'This request is no longer pending' }
      await resolveLocalRequest(match.id, { status })
    }
  } catch {
    return { ok: false, error: 'Could not update the request. Please try again.' }
  }
  return { ok: true }
}

/**
 * The user's chats, newest first.
 * @param {boolean} [isOnline]
 * @returns {Promise<{id: string, reference: string, title: string, updatedAt: string}[]>}
 */
export async function getChats(isOnline = true) {
  const owner = await ownerRef()
  if (!owner) return []
  const chats = await (isOnline ? listChatDocs(owner) : listLocalChats(owner)).catch(() => [])
  return (chats ?? [])
    .map((c) => ({
      id: c.chatReference,
      reference: c.chatReference,
      title: c.title,
      updatedAt: typeof c.updatedAt === 'number' ? new Date(c.updatedAt).toISOString() : c.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0))
}

/**
 * Start a chat. Offline the reference is minted here - there's no server to mint one, and both
 * stores key messages by it.
 * @param {string} title
 * @param {boolean} [isOnline]
 * @returns {Promise<{ok: boolean, chat?: object, error?: string}>}
 */
export async function createChat(title, isOnline = true) {
  const owner = await ownerRef()
  if (!owner) return { ok: false, error: 'You need to be signed in' }
  try {
    const chat = isOnline
      ? await createChatDoc({ owner, title })
      : await createLocalChat({ ownerPartyRef: owner, chatReference: randomUUID(), title })
    return { ok: true, chat: { id: chat.chatReference, reference: chat.chatReference, title: chat.title } }
  } catch {
    return { ok: false, error: 'Could not start the chat.' }
  }
}

// Inline cards (spending charts) are kept in the text-only message store by JSON-encoding them behind
// this marker (a record-separator char the user can't type), so chat history round-trips them without
// a schema or on-device store change, online and offline alike.
const CARD_PREFIX = '␞'
const encodeCard = (card) => `${CARD_PREFIX}${JSON.stringify(card)}`

/** Reconstruct a stored message: a card if it was encoded behind the marker, else plain text. */
function decodeChatMessage(m) {
  if (typeof m.text === 'string' && m.text.startsWith(CARD_PREFIX)) {
    try {
      return { id: String(m.id), role: m.role, ...JSON.parse(m.text.slice(CARD_PREFIX.length)) }
    } catch {
      /* corrupt payload; fall back to showing it as plain text */
    }
  }
  return { id: String(m.id), role: m.role, type: 'text', text: m.text }
}

/**
 * A chat's messages, oldest first. Text and any inline cards (e.g. a spending chart) both round-trip.
 * @param {string} reference - The `chatReference`.
 * @param {boolean} [isOnline]
 */
export async function getChatMessages(reference, isOnline = true) {
  if (!reference) return []
  const rows = await (isOnline ? listChatMessageDocs(reference) : listLocalChatMessages(reference)).catch(
    () => [],
  )
  return (rows ?? []).map(decodeChatMessage)
}

/**
 * Delete a chat and its messages from whichever store holds it: Atlas when online (the sync
 * layer propagates to the device), the on-device store when offline (and up to Atlas on sync).
 * @param {string} reference - The `chatReference`.
 * @param {boolean} [isOnline]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function deleteChat(reference, isOnline = true) {
  if (!reference) return { ok: false, error: 'No chat given.' }
  try {
    if (isOnline) {
      const owner = await ownerRef()
      if (!owner) return { ok: false, error: 'You need to be signed in' }
      const chats = await listChatDocs(owner)
      const chat = (chats ?? []).find((c) => c.chatReference === reference)
      if (!chat?.id) return { ok: false, error: 'Chat not found.' }
      await deleteChatDoc(chat.id)
    } else {
      await deleteLocalChat(reference)
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete the chat.' }
  }
}

/**
 * Append a message to a chat.
 * @param {string} reference - The `chatReference`.
 * @param {{role: 'user'|'assistant', text: string}} message
 * @param {boolean} [isOnline]
 */
export async function appendChatMessage(reference, { role, text }, isOnline = true) {
  if (!reference || !text?.trim()) return { ok: false }
  try {
    if (isOnline) {
      const owner = await ownerRef()
      const chats = await listChatDocs(owner)
      const chat = (chats ?? []).find((c) => c.chatReference === reference)
      if (!chat?.id) return { ok: false }
      await createChatMessageDoc({ chatId: chat.id, chatReference: reference, role, text })
    } else {
      await createLocalChatMessage(reference, { role, text })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * Persist an inline card (e.g. a spending chart) as an assistant message, so it survives closing and
 * reopening the chat. Stored behind the card marker in the same text field as everything else.
 * @param {string} reference - The `chatReference`.
 * @param {object} card - The rendered card message minus its id, e.g. `{ type: 'chart', chartTitle, chartData }`.
 * @param {boolean} [isOnline]
 */
export async function appendChatCard(reference, card, isOnline = true) {
  return appendChatMessage(reference, { role: 'assistant', text: encodeCard(card) }, isOnline)
}
