'use server'

import { randomUUID } from 'crypto'
import { getSession } from '@/lib/auth/session'
import {
  acceptRtpRequest,
  cancelRtpRequest,
  createBeneficiary,
  createRtpRequest,
  listAccounts,
  listBeneficiaries,
  listRtpRequests,
  listTransactions,
  presentRtpRequest,
  rejectRtpRequest,
  sendToBeneficiary,
} from '@/lib/psp/PspClient'
import { classifyNotes, emojiForCategory } from '@/lib/wallet/categories'
import {
  listContactEnrichment,
  listTransactionEnrichment,
  searchTransactionEnrichment,
  spendingByContactEnrichment,
} from '@/lib/backend/enrichment'
import {
  cacheAccount,
  createLocalChat,
  createLocalChatMessage,
  createLocalContact,
  createLocalRequest,
  deleteLocalChat,
  deleteLocalContact,
  deleteLocalRequest,
  deleteLocalTransaction,
  listLocalAccounts,
  listLocalChatMessages,
  listLocalChats,
  listLocalContacts,
  listLocalRequests,
  listLocalTransactions,
  localSpendingByContact,
  createLocalTransaction,
  createPendingSend,
  listPendingSends,
  searchLocalTransactions,
  updateLocalRequest,
  updateLocalTransaction,
} from '@/lib/local/LocalStoreClient'
import { detectLookupType } from './contacts'
import { isAwaitingPayer, toRequestPaymentRows, toRequestStatus } from './requests'
import { avatarFor, byNewestFirst, formatDate, formatMoney } from './format'
import { DEMO_USERS } from '@/lib/demo-users'

// Contacts keep only a masked hint, so match it back, and only on an unambiguous single fit.
function demoAvatarByHint(hint) {
  const value = hint?.trim().toLowerCase()
  if (!value) return undefined
  const at = value.indexOf('@')
  const matches = DEMO_USERS.filter((u) => {
    if (at > 0) {
      const [local, domain] = u.email.toLowerCase().split('@')
      return local[0] === value[0] && domain === value.slice(at + 1)
    }
    // Phone hint: Leafy Pay keeps the country/area prefix and the last three digits.
    const digits = value.replace(/\D/g, '')
    const own = u.phone?.replace(/\D/g, '') ?? ''
    return digits.length >= 4 && own.startsWith(digits.slice(0, -3)) && own.endsWith(digits.slice(-3))
  })
  return matches.length === 1 ? { seed: matches[0].seed, bg: matches[0].bg } : undefined
}

// Incoming requests carry no hint, but Leafy Pay's profile name is not user-editable.
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
    return cached.map((a) =>
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

/** The device row for a Leafy Pay beneficiary, which Sync carries to `walletContacts`. */
const toContactRow = (owner, b) => ({
  ownerPartyRef: owner,
  counterpartyArrangementReference: b.reference,
  counterpartyLabel: b.label,
  counterpartyLookupType: b.lookupType,
  counterpartyLookupHint: b.lookupHint,
})

/** Shape a Leafy Pay beneficiary into the UI contact used across the app. */
function toContactView(b) {
  return {
    id: b.reference,
    reference: b.reference,
    name: b.label,
    lookupHint: b.lookupHint,
    ...(demoAvatarByHint(b.lookupHint) ?? avatarFor(b.reference ?? b.label)),
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
  const atlasByRef = new Map(enrichment.map((e) => [e.counterpartyArrangementReference, e]))

  if (backfill && owner) {
    const missing = beneficiaries.filter((b) => !atlasByRef.has(b.reference))
    await Promise.all(
      missing.map((b) =>
        createLocalContact(toContactRow(owner, b))
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
    }
  })
}

/** Contacts held on the device, synced down from Atlas. The only source when offline. */
async function localContacts(owner) {
  const contacts = await listLocalContacts().catch(() => [])
  return contacts
    .filter((c) => !owner || c.ownerPartyRef === owner)
    .map((c) => ({
      reference: c.counterpartyArrangementReference,
      label: c.counterpartyLabel,
      lookupType: c.counterpartyLookupType,
      lookupHint: c.counterpartyLookupHint,
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
 * Add a contact by a registered Leafy Pay email or phone, then mirror it to Atlas. A miss reads the
 * same whether nobody matched or they were already saved; the address is discarded after the lookup.
 * @param {{lookupValue: string, label?: string}} input
 * @returns {Promise<{ok: boolean, contact?: object, error?: string}>}
 */
export async function addContact({ lookupValue, label = '' } = {}) {
  const value = String(lookupValue ?? '').trim()
  if (!value) return { ok: false, error: 'Enter an email or phone number' }
  const lookupType = detectLookupType(value)

  let result
  try {
    result = await createBeneficiary({ lookupType, lookupValue: value, label: label.trim() })
  } catch {
    return { ok: false, error: 'Could not add contact. Please try again.' }
  }
  if (!result.found) {
    const what = lookupType === 'email' ? 'that email' : 'that phone number'
    return { ok: false, error: `No Leafy Pay user is registered with ${what}.` }
  }
  const beneficiary = result.beneficiary

  const owner = await ownerRef()
  if (owner) {
    try {
      await createLocalContact(toContactRow(owner, beneficiary))
    } catch {
      return { ok: false, error: 'Could not save the contact on this device.' }
    }
  }

  return { ok: true, contact: toContactView(beneficiary) }
}

// Leafy Pay owns beneficiaries: the wallet only adds, and reconcile prunes the replica at login.

// Leafy Pay stamps this on a P2P transfer that was sent without a note; treated here as "no note".
const DEFAULT_REMITTANCE = 'P2P transfer via beneficiary portal'

// A send buffered on the device, carrying a stand-in reference until settlement swaps in the real one.
const LOCAL_PENDING = 'local_pending'
const LOCAL_SYNCED = 'synced'
const LOCAL_REFERENCE_PREFIX = 'local-'

// `walletTransactions.leafyPayStatus` for a transfer Leafy Pay reports as `completed`.
const SETTLED_STATUS = 'settled'

/**
 * Shape one transaction row for the UI, from either source. `fallbackName` covers a counterparty
 * with no saved contact: paying a request does not require having saved the requester.
 */
function toTransactionRow({ reference, counterpartyRef, contact, fallbackName, isReceived, magnitude, currency, note, createdAt, status, isPending }) {
  return {
    id: reference,
    reference,
    counterpartyRef: counterpartyRef ?? null,
    name: contact?.label || fallbackName || 'Leafy Pay user',
    lookupHint: contact?.lookupHint || '',
    note: note || 'No note',
    amount: isReceived ? magnitude : -magnitude,
    currency,
    date: formatDate(createdAt),
    createdAt,
    status,
    isPending,
    ...(demoAvatarByHint(contact?.lookupHint) ??
      demoAvatarByName(fallbackName) ??
      avatarFor(counterpartyRef ?? reference)),
  }
}

/** Transactions held on the device: synced down from Atlas, plus any send queued while offline. */
/** Sends still waiting on Leafy Pay. Folded into both read paths, or a just-made payment is invisible. */
async function pendingSendRows(owner, contactByRef) {
  const queued = await listPendingSends(owner ?? undefined).catch(() => [])
  return queued.map((p) =>
    toTransactionRow({
      reference: `${LOCAL_REFERENCE_PREFIX}${p.id}`,
      counterpartyRef: p.counterpartyArrangementReference,
      contact: contactByRef.get(p.counterpartyArrangementReference),
      isReceived: p.direction === 'received',
      magnitude: Math.abs(p.amount),
      currency: p.currency,
      note: p.note,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      status: LOCAL_PENDING,
      isPending: true,
    }),
  )
}

async function localTransactions(owner) {
  const [transactions, contacts] = await Promise.all([
    listLocalTransactions().catch(() => []),
    localContacts(owner),
  ])
  const contactByRef = new Map(contacts.map((c) => [c.reference, c]))

  const rows = transactions
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
  rows.push(...(await pendingSendRows(owner, contactByRef)))
  rows.sort(byNewestFirst)
  return rows
}

/**
 * The user's transactions, newest first: Leafy Pay transfers merged with Atlas enrichment and contact
 * aliases by `leafyPayTransferReference`. Request settlements are folded in, since Leafy Pay omits them.
 * @param {boolean} [isOnline]
 */
export async function getTransactions(isOnline = true) {
  const owner = await ownerRef()
  if (!isOnline) return localTransactions(owner)
  const [transactions, contacts, enrichment, requests] = await Promise.all([
    listTransactions(),
    resolveContacts(owner),
    owner ? listTransactionEnrichment(owner).catch(() => []) : [],
    bothRequestBoxes(),
  ])
  const contactByRef = new Map(contacts.map((c) => [c.reference, c]))
  const enrichByRef = new Map(enrichment.map((e) => [e.leafyPayTransferReference, e]))

  // Settling can outlast the send flow's watcher, leaving a stale pending row behind.
  const localByRef = new Map(
    (await listLocalTransactions().catch(() => [])).map((t) => [t.leafyPayTransferReference, t]),
  )
  await Promise.all(
    transactions
      .filter((t) => {
        const local = localByRef.get(t.reference)
        return t.status === 'completed' && local?.id && local.leafyPayStatus !== SETTLED_STATUS
      })
      .map((t) =>
        updateLocalTransaction(localByRef.get(t.reference).id, {
          leafyPayStatus: SETTLED_STATUS,
          settledAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
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

  const known = new Set(transactions.map((t) => t.reference))
  for (const row of toRequestPaymentRows(requests, known)) {
    const enrich = enrichByRef.get(row.reference)
    rows.push(
      toTransactionRow({
        ...row,
        contact: contactByRef.get(row.counterpartyRef),
        note: enrich?.note || row.note,
        isPending: row.status !== 'completed',
      }),
    )
  }

  // A queue row surviving online means its replay failed; still show it.
  rows.push(...(await pendingSendRows(owner, contactByRef)))
  rows.sort(byNewestFirst)
  return rows
}

/**
 * Move the money, then write the transaction to the device for Sync to carry up. Writing the row and
 * retiring `queuedId` is one device transaction, so a queued send cannot replay twice.
 * @param {{ownerPartyRef?: string, counterpartyArrangementReference: string, amount: number, note?: string}} send
 * @param {{fromAccountReference?: string, queuedId?: number}} [options]
 * @returns {Promise<{ok: boolean, reference?: string, status?: string, error?: string}>}
 */
async function settleSend(send, { fromAccountReference, queuedId } = {}) {
  let transfer
  try {
    transfer = await sendToBeneficiary(send.counterpartyArrangementReference, {
      amount: send.amount,
      note: send.note || '',
      fromAccountRef: fromAccountReference,
    })
  } catch (e) {
    return { ok: false, error: e?.body || 'Transfer failed. Please try again.' }
  }

  try {
    await createLocalTransaction({
      leafyPayTransferReference: transfer.reference,
      ownerPartyRef: send.ownerPartyRef ?? '',
      counterpartyArrangementReference: send.counterpartyArrangementReference,
      amount: send.amount,
      currency: 'EUR',
      direction: 'sent',
      note: send.note || '',
      leafyPayStatus: toEnrichmentStatus(transfer.status),
      localSyncStatus: LOCAL_SYNCED,
      settledAt: transfer.status === 'completed' ? Date.now() : 0,
      retirePendingSendId: queuedId,
    })
  } catch {
    return { ok: false, error: 'Payment sent, but saving it on this device failed.' }
  }

  return { ok: true, reference: transfer.reference, status: transfer.status }
}

/**
 * Send a P2P transfer. Online, Leafy Pay first, then the device. Offline it waits in a device-only
 * queue Atlas never sees, so `walletTransactions` only holds transfers Leafy Pay accepted.
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

  const owner = await ownerRef()
  const send = {
    ownerPartyRef: owner ?? '',
    counterpartyArrangementReference,
    amount,
    note: note || '',
  }

  if (!isOnline) {
    try {
      const queued = await createPendingSend({ ...send, currency: 'EUR', direction: 'sent' })
      return { ok: true, reference: `${LOCAL_REFERENCE_PREFIX}${queued.id}`, status: LOCAL_PENDING }
    } catch {
      return { ok: false, error: 'Could not queue the payment on this device.' }
    }
  }

  return settleSend(send, { fromAccountReference })
}

/**
 * Settlement status of a sent transfer, read from the transaction list (the status endpoint is
 * session-only). A payment that settled a request is absent there, so it falls back to the request.
 * @param {string} reference - The transfer reference returned by `sendMoney` or `payRequest`.
 * @returns {Promise<{status: 'completed'|'pending'|'failed'|'unknown'}>}
 */
export async function getTransferStatus(reference) {
  if (!reference) return { status: 'unknown' }
  const transactions = await listTransactions()
  const match = transactions.find((t) => t.reference === reference)
  if (!match) {
    const request = (await bothRequestBoxes()).find((r) => r.executionReference === reference)
    if (request?.status === 'payment_settled') return { status: 'completed' }
    if (request?.status === 'payment_failed') return { status: 'failed' }
    return { status: 'pending' }
  }
  if (match.status === 'completed') return { status: 'completed' }
  if (match.status === 'failed' || match.status === 'exception') return { status: 'failed' }
  return { status: 'pending' }
}

/**
 * Persist a transfer's settlement on the device. Leafy Pay is the only source of this status.
 * @param {string} reference - The `leafyPayTransferReference`.
 * @param {'completed'|'failed'} status
 */
export async function markTransferSettled(reference, status) {
  const owner = await ownerRef()
  if (!owner || !reference) return
  try {
    const rows = await listLocalTransactions()
    const match = (rows ?? []).find(
      (t) => t.leafyPayTransferReference === reference && (!owner || t.ownerPartyRef === owner),
    )
    if (!match?.id) return
    await updateLocalTransaction(match.id, {
      leafyPayStatus: status === 'completed' ? SETTLED_STATUS : 'failed',
      settledAt: Date.now(),
    })
  } catch {
    // Non-fatal: Leafy Pay still has the status, and a later poll retries.
  }
}

/**
 * Send each queued payment for real, writing the confirmed transaction and retiring the queue row. A
 * failed replay leaves its row queued for the next reconnect.
 * @returns {Promise<{replayed: number, failed: number, references: string[]}>}
 */
export async function replayPendingSends() {
  const owner = await ownerRef()
  const queued = await listPendingSends(owner ?? undefined).catch(() => [])

  let replayed = 0
  let failed = 0
  const references = []
  for (const p of queued) {
    const settled = await settleSend(
      {
        ownerPartyRef: p.ownerPartyRef,
        counterpartyArrangementReference: p.counterpartyArrangementReference,
        amount: p.amount,
        note: p.note || '',
      },
      { queuedId: p.id },
    )
    if (!settled.ok) {
      failed += 1
      continue
    }
    if (settled.reference) references.push(settled.reference)
    replayed += 1
  }
  return { replayed, failed, references }
}

const toEnrichmentStatus = (status) => {
  if (status === 'completed') return SETTLED_STATUS
  if (status === 'failed' || status === 'exception') return status
  return 'pending'
}

/**
 * Converge the enrichment stores to Leafy Pay, the source of truth: orphaned Atlas rows are pruned and
 * unseen transfers adopted, both syncing down to the device. Device-queued writes are never touched.
 * @returns {Promise<{ok: boolean, prunedTransactions?: number, prunedContacts?: number, prunedRequests?: number, adoptedTransactions?: number}>}
 */
export async function reconcileWithLeafyPay() {
  const owner = await ownerRef()
  if (!owner) return { ok: false }
  try {
    const [transfers, beneficiaries, requests, allTxRows, allContactRows, requestDocs] =
      await Promise.all([
        listTransactions(),
        listBeneficiaries(),
        bothRequestBoxes(),
        listLocalTransactions().catch(() => []),
        listLocalContacts().catch(() => []),
        listLocalRequests().catch(() => []),
      ])
    const ownedBy = (rows) => rows.filter((r) => !owner || r.ownerPartyRef === owner)
    const txDocs = ownedBy(allTxRows)
    const contactDocs = ownedBy(allContactRows)
    const transferRefs = new Set(transfers.map((t) => t.reference))
    const beneficiaryRefs = new Set(beneficiaries.map((b) => b.reference))
    const requestRefs = new Set(requests.map((r) => r.reference))
    const enrichedRefs = new Set(txDocs.map((d) => d.leafyPayTransferReference))
    // Request settlements are absent from Leafy Pay's history, so don't mistake them for orphans.
    const requestPaymentRefs = new Set(requests.map((r) => r.executionReference).filter(Boolean))

    const orphanTransactions = txDocs.filter(
      (d) =>
        !String(d.leafyPayTransferReference ?? '').startsWith(LOCAL_REFERENCE_PREFIX) &&
        !transferRefs.has(d.leafyPayTransferReference) &&
        !requestPaymentRefs.has(d.leafyPayTransferReference),
    )
    const orphanContacts = contactDocs.filter(
      (d) => !beneficiaryRefs.has(d.counterpartyArrangementReference),
    )
    const orphanRequests = requestDocs.filter(
      (d) => d.localSyncStatus !== LOCAL_PENDING && !requestRefs.has(d.requestReference),
    )
    // Note stays empty on adoption: Leafy Pay's own note is portal boilerplate, not worth embedding.
    const foreignTransfers = transfers.filter((t) => !enrichedRefs.has(t.reference))
    // Only the payer writes enrichment for a request payment, so the payee has nothing on-device.
    const requestPayments = requests.filter(
      (r) => !r.isIncoming && r.executionReference && !enrichedRefs.has(r.executionReference),
    )

    const adopt = (row) => createLocalTransaction({ ownerPartyRef: owner, ...row }).catch(() => {})

    await Promise.all([
      ...orphanTransactions.map((d) => deleteLocalTransaction(d.id).catch(() => {})),
      ...orphanContacts.map((d) => deleteLocalContact(d.id).catch(() => {})),
      ...orphanRequests.map((d) => deleteLocalRequest(d.id).catch(() => {})),
      ...requests.map((r) => mirrorRequest(r, owner, requestDocs)),
      ...foreignTransfers.map((t) =>
        adopt({
          leafyPayTransferReference: t.reference,
          counterpartyArrangementReference: t.counterpartyReference ?? '',
          amount: Math.abs(t.value),
          currency: t.currency,
          note: '',
          direction: t.direction,
          leafyPayStatus: toEnrichmentStatus(t.status),
          localSyncStatus: LOCAL_SYNCED,
        }),
      ),
      ...requestPayments.map((r) =>
        adopt({
          leafyPayTransferReference: r.executionReference,
          counterpartyArrangementReference: r.payerCounterpartyRef || '',
          amount: Math.abs(r.amount),
          currency: r.currency,
          note: r.note || '',
          direction: 'received',
          leafyPayStatus: r.status === 'payment_settled' ? SETTLED_STATUS : 'pending',
          localSyncStatus: LOCAL_SYNCED,
        }),
      ),
    ])
    return {
      ok: true,
      prunedTransactions: orphanTransactions.length,
      prunedContacts: orphanContacts.length,
      prunedRequests: orphanRequests.length,
      adoptedTransactions: foreignTransfers.length + requestPayments.length,
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

  return hits.map((t) => {
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

  return rows.map((r) => ({
    contact: labelByRef.get(r.counterpartyArrangementReference) || 'Leafy Pay user',
    total: r.total,
    count: r.count,
    currency: r.currency,
  }))
}

/**
 * Spending grouped into categories (Dining, Bills, ...), largest first. Each note is matched to its
 * nearest category by embedding similarity, the same model as note search; blank notes are "Other".
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
 * Shape a request into the UI row used by the inbox, the bell and the awaiting-payment list. Keyed
 * by the Leafy Pay reference: the only id that survives the connection dropping mid-action.
 */
function toRequestView({ reference, name, amount, currency, note, status, createdAt, contact }) {
  const iso = typeof createdAt === 'number' ? new Date(createdAt).toISOString() : createdAt
  return {
    id: reference,
    reference,
    counterpartyRef: contact?.reference ?? null,
    name: name || 'Leafy Pay user',
    amount,
    currency,
    note: note || 'No note',
    status: toRequestStatus(status),
    date: formatDate(iso),
    createdAt: iso,
    ...(demoAvatarByHint(contact?.lookupHint) ?? demoAvatarByName(name) ?? avatarFor(reference)),
  }
}

/**
 * Leafy Pay's record, shaped for the Atlas replica that Sync carries down to the device. Party refs
 * come from the session, not from Leafy Pay: its ids are not the `sub` the offline read filters on.
 * @param {object} request - A normalized request, tagged `isIncoming` (the user is the payer).
 * @param {string|null} owner - The signed-in user's `sub`, stamped on whichever side they are.
 */
function toRequestDoc(request, owner) {
  const isResolved = toRequestStatus(request.status) !== 'pending'
  return {
    requestReference: request.reference,
    requesterPartyRef: request.isIncoming ? '' : owner || '',
    requesterName: request.payeeName,
    payerPartyRef: request.isIncoming ? owner || '' : '',
    payerCounterpartyRef: request.payerCounterpartyRef,
    amount: request.amount,
    currency: request.currency,
    note: request.note || null,
    status: request.status,
    localSyncStatus: 'synced',
    leafyPayTransferReference: request.executionReference,
    createdAt: request.createdAt,
    resolvedAt: isResolved ? request.updatedAt : null,
  }
}

/**
 * Both request boxes, each row tagged with which side the user is on. Resolves empty rather than
 * throwing: requests enrich the transaction list, they never gate it.
 */
async function bothRequestBoxes() {
  const [inbox, outbox] = await Promise.all([
    listRtpRequests('inbox').catch(() => []),
    listRtpRequests('outbox').catch(() => []),
  ])
  return [
    ...inbox.map((r) => ({ ...r, isIncoming: true })),
    ...outbox.map((r) => ({ ...r, isIncoming: false })),
  ]
}

/**
 * Write Leafy Pay's view of a request to the device, updating in place so the other side's party ref
 * survives. `known` lets a caller pass rows it already read.
 * @param {object} request - A normalized request, tagged `isIncoming`.
 * @param {string|null} owner - The signed-in user's `sub`.
 * @param {object[]} [known]
 */
async function mirrorRequest(request, owner, known) {
  const doc = toRequestDoc(request, owner)
  const rows = known ?? (await listLocalRequests().catch(() => []))
  const existing = rows.find((r) => r.requestReference === doc.requestReference)
  const write = existing
    ? updateLocalRequest(existing.id, {
        status: doc.status,
        localSyncStatus: doc.localSyncStatus,
        ...(doc.requesterPartyRef ? { requesterPartyRef: doc.requesterPartyRef } : {}),
        ...(doc.payerPartyRef ? { payerPartyRef: doc.payerPartyRef } : {}),
        leafyPayTransferReference: doc.leafyPayTransferReference ?? '',
        resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).getTime() : 0,
      })
    : createLocalRequest({
        ...doc,
        note: doc.note ?? '',
        leafyPayTransferReference: doc.leafyPayTransferReference ?? '',
        createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : undefined,
        resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).getTime() : 0,
      })
  return write.catch(() => {})
}

// Leafy Pay's RTP error codes that mean something a person can act on; anything else is a retry.
const RTP_ERRORS = {
  no_payout_account: 'You need an active account before you can request money.',
  no_funding_account: 'You need an active account to pay this request.',
  insufficient_funds: 'Not enough available balance to pay this request.',
  not_payer: 'This request is not addressed to you.',
  invalid_state: 'This request is no longer pending.',
  not_found: 'This request no longer exists.',
}

/** Turn a Leafy Pay error body into something worth showing, or fall back to the caller's wording. */
function rtpErrorMessage(error, fallback) {
  try {
    const code = JSON.parse(error?.body ?? '{}').error
    if (RTP_ERRORS[code]) return RTP_ERRORS[code]
  } catch {
    /* not a JSON error body; fall through to the caller's wording */
  }
  return fallback
}

/**
 * Raise a payment request against a saved contact. The payer sees it whether or not they saved this
 * user back, and presenting is what delivers it. Offline it is buffered and replayed on reconnect.
 * @param {{counterpartyArrangementReference: string, amount: number, note?: string, isOnline?: boolean}} input
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function createRequest({ counterpartyArrangementReference, amount, note = '', isOnline = true }) {
  if (!counterpartyArrangementReference || !(amount > 0)) {
    return { ok: false, error: 'A contact and an amount are required' }
  }
  const session = await getSession()
  if (!session?.sub) return { ok: false, error: 'You need to be signed in' }

  if (!isOnline) {
    try {
      await createLocalRequest({
        requestReference: `${LOCAL_REFERENCE_PREFIX}${randomUUID()}`,
        requesterPartyRef: session.sub,
        requesterName: session.name || session.email || 'You',
        payerCounterpartyRef: counterpartyArrangementReference,
        amount,
        currency: 'EUR',
        note: note || null,
      })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not save the request on this device.' }
    }
  }

  try {
    const created = await createRtpRequest({
      payerCounterpartyRef: counterpartyArrangementReference,
      amount,
      note,
      idempotencyKey: randomUUID(),
    })
    // Leafy Pay accepts an unresolvable contact, leaving the request undeliverable with no payer.
    if (!created.payerPartyRef) {
      await cancelRtpRequest(created.reference).catch(() => {})
      return { ok: false, error: 'That contact is no longer saved, so the request was not sent.' }
    }
    await mirrorRequest(await presentRtpRequest(created.reference), session.sub)
  } catch (e) {
    return { ok: false, error: rtpErrorMessage(e, 'Could not send the request. Please try again.') }
  }
  return { ok: true }
}

/**
 * The user's requests: `incoming` are addressed to them, `outgoing` are ones they raised. Online
 * they come from Leafy Pay and are mirrored to Atlas on the way past. Sorted newest first.
 * @param {boolean} [isOnline]
 * @returns {Promise<{incoming: object[], outgoing: object[]}>}
 */
export async function getRequests(isOnline = true) {
  const owner = await ownerRef()
  if (!owner) return { incoming: [], outgoing: [] }

  const contacts = isOnline ? await resolveContacts(owner) : await localContacts(owner)
  const contactByRef = new Map(contacts.map((c) => [c.reference, c]))

  let incoming
  let outgoing
  if (isOnline) {
    const requests = await bothRequestBoxes()
    await Promise.all(requests.map((r) => mirrorRequest(r, owner)))
    const view = (r) => {
      const contact = r.isIncoming ? undefined : contactByRef.get(r.payerCounterpartyRef)
      return toRequestView({
        reference: r.reference,
        name: r.isIncoming ? r.payeeName : contact?.label,
        amount: r.amount,
        currency: r.currency,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        contact,
      })
    }
    incoming = requests.filter((r) => r.isIncoming && isAwaitingPayer(r.status)).map(view)
    outgoing = requests.filter((r) => !r.isIncoming).map(view)
  } else {
    const [inbox, outbox] = await Promise.all([
      listLocalRequests({ payerPartyRef: owner }).catch(() => []),
      listLocalRequests({ requesterPartyRef: owner }).catch(() => []),
    ])
    const view = (r, isIncoming) => {
      const contact = isIncoming ? undefined : contactByRef.get(r.payerCounterpartyRef)
      return toRequestView({
        reference: r.requestReference,
        name: isIncoming ? r.requesterName : contact?.label,
        amount: r.amount,
        currency: r.currency,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        contact,
      })
    }
    incoming = inbox.filter((r) => isAwaitingPayer(r.status)).map((r) => view(r, true))
    outgoing = outbox.map((r) => view(r, false))
  }

  return { incoming: incoming.sort(byNewestFirst), outgoing: outgoing.sort(byNewestFirst) }
}

/**
 * Send each queued request for real, then drop the local stand-in; its deletion propagates through
 * Sync. A failed replay keeps its record for the next reconnect.
 * @returns {Promise<{replayed: number, failed: number}>}
 */
export async function replayPendingRequests() {
  const owner = await ownerRef()
  const queued = await listLocalRequests({ localSyncStatus: LOCAL_PENDING }).catch(() => [])

  let replayed = 0
  let failed = 0
  for (const r of queued.filter((x) => !owner || x.requesterPartyRef === owner)) {
    const sent = await createRequest({
      counterpartyArrangementReference: r.payerCounterpartyRef,
      amount: r.amount,
      note: r.note || '',
    })
    if (!sent.ok) {
      failed += 1
      continue
    }
    try {
      await deleteLocalRequest(r.id)
      replayed += 1
    } catch {
      // Leafy Pay has the request; a stale local copy beats risking a second one, so leave it.
      failed += 1
    }
  }
  return { replayed, failed }
}

/**
 * Approve a request addressed to the user. Leafy Pay creates the payment itself, so the requester
 * need not be a saved contact. The note is ours and lives in Atlas, searchable like any other.
 * @param {string} reference - The Leafy Pay request reference.
 * @param {string} [fromAccountReference] - Funding account; omit for the default.
 * @param {string} [noteOverride] - The note to file the resulting payment under (edited at review).
 * @returns {Promise<{ok: boolean, reference?: string, status?: string, error?: string}>}
 */
export async function payRequest(reference, fromAccountReference, noteOverride) {
  if (!reference) return { ok: false, error: 'Missing request' }
  const owner = await ownerRef()
  if (!owner) return { ok: false, error: 'You need to be signed in' }

  const inbox = await listRtpRequests('inbox').catch(() => [])
  const request = inbox.find((r) => r.reference === reference)
  if (!request || !isAwaitingPayer(request.status)) {
    return { ok: false, error: 'This request is no longer pending' }
  }

  let result
  try {
    result = await acceptRtpRequest(reference, {
      fromAccountRef: fromAccountReference,
      idempotencyKey: randomUUID(),
    })
  } catch (e) {
    return { ok: false, error: rtpErrorMessage(e, 'Could not pay this request. Please try again.') }
  }
  if (result.status !== 'accepted') {
    return { ok: false, error: result.reason || 'Leafy Pay could not complete this payment.' }
  }

  // The money has moved: never report failure past this point, or the caller retries and pays twice.
  if (result.executionReference) {
    await createLocalTransaction({
      leafyPayTransferReference: result.executionReference,
      ownerPartyRef: owner,
      // The payer holds no saved contact for the requester, and approving does not create one.
      counterpartyArrangementReference: '',
      amount: request.amount,
      currency: request.currency,
      note: noteOverride || '',
      direction: 'sent',
      leafyPayStatus: 'pending',
      localSyncStatus: LOCAL_SYNCED,
    }).catch(() => {})
  }
  return { ok: true, reference: result.executionReference, status: 'pending' }
}

/**
 * Decline a request addressed to the user, or cancel one they raised. Both are Leafy Pay lifecycle
 * transitions, so they need a connection even though no money moves.
 * @param {string} reference - The Leafy Pay request reference.
 * @param {'declined'|'cancelled'} status
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function resolveRequest(reference, status) {
  if (!reference) return { ok: false, error: 'Missing request' }
  const owner = await ownerRef()
  if (!owner) return { ok: false, error: 'You need to be signed in' }

  try {
    // Cancelling is the requester's call, declining the payer's.
    const isIncoming = status !== 'cancelled'
    const resolved = isIncoming
      ? await rejectRtpRequest(reference)
      : await cancelRtpRequest(reference)
    await mirrorRequest({ ...resolved, isIncoming }, owner)
  } catch (e) {
    return { ok: false, error: rtpErrorMessage(e, 'Could not update the request. Please try again.') }
  }
  return { ok: true }
}

// A shared demo user accumulates chats fast, and the history list is the whole of the UI for them.
const MAX_CHATS = 8

/**
 * The user's chats, newest first, capped at the most recent {@link MAX_CHATS}.
 * @returns {Promise<{id: string, reference: string, title: string, updatedAt: string}[]>}
 */
export async function getChats() {
  const owner = await ownerRef()
  if (!owner) return []
  const chats = await listLocalChats(owner).catch(() => [])
  return chats
    .map((c) => ({
      id: c.chatReference,
      reference: c.chatReference,
      title: c.title,
      updatedAt: typeof c.updatedAt === 'number' ? new Date(c.updatedAt).toISOString() : c.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0))
    .slice(0, MAX_CHATS)
}

/**
 * Start a chat. The reference is minted here because messages are keyed by it in both stores.
 * @param {string} title
 * @returns {Promise<{ok: boolean, chat?: object, error?: string}>}
 */
export async function createChat(title) {
  const owner = await ownerRef()
  if (!owner) return { ok: false, error: 'You need to be signed in' }
  try {
    const chat = await createLocalChat({ ownerPartyRef: owner, chatReference: randomUUID(), title })
    return { ok: true, chat: { id: chat.chatReference, reference: chat.chatReference, title: chat.title } }
  } catch {
    return { ok: false, error: 'Could not start the chat.' }
  }
}

// Cards are JSON-encoded behind this record-separator char so the text-only store round-trips them.
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
 */
export async function getChatMessages(reference) {
  if (!reference) return []
  const rows = await listLocalChatMessages(reference).catch(() => [])
  return (rows ?? []).map(decodeChatMessage)
}

/**
 * Delete a chat; the store cascades to its messages and the deletion propagates through Sync.
 * @param {string} reference - The `chatReference`.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function deleteChat(reference) {
  if (!reference) return { ok: false, error: 'No chat given.' }
  try {
    await deleteLocalChat(reference)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete the chat.' }
  }
}

/**
 * Append a message to a chat.
 * @param {string} reference - The `chatReference`.
 * @param {{role: 'user'|'assistant', text: string}} message
 */
export async function appendChatMessage(reference, { role, text }) {
  if (!reference || !text?.trim()) return { ok: false }
  try {
    await createLocalChatMessage(reference, { role, text })
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
 */
export async function appendChatCard(reference, card) {
  return appendChatMessage(reference, { role: 'assistant', text: encodeCard(card) })
}

/** The handful of fields the sync inspector shows, from either store's raw document. */
function toSyncDoc(doc) {
  if (!doc) return null
  return {
    id: String(doc.id ?? ''),
    reference: doc.leafyPayTransferReference ?? null,
    amount: doc.amount ?? 0,
    currency: doc.currency ?? 'EUR',
    note: doc.note || null,
    embeddingDims: doc.noteEmbeddingDims ?? 0,
    status: doc.leafyPayStatus ?? 'pending',
    syncStatus: doc.localSyncStatus ?? 'synced',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  }
}

/**
 * Newest stored transaction on each side for the sync inspector: Atlas above, ObjectBox below. Read
 * from both whatever the simulated connection, so the card shows them diverge offline then converge.
 * @returns {Promise<{atlas: object|null, local: object|null}>}
 */
export async function getDbSyncSnapshot() {
  const owner = await ownerRef()
  const [atlasRows, localRows] = await Promise.all([
    owner ? listTransactionEnrichment(owner).catch(() => []) : [],
    listLocalTransactions().catch(() => []),
  ])
  // Atlas already sorts newest first; the local store returns insertion order, so sort it here.
  const local = [...localRows].filter((t) => !owner || t.ownerPartyRef === owner).sort(byNewestFirst)
  return { atlas: toSyncDoc(atlasRows[0]), local: toSyncDoc(local[0]) }
}
