'use server'

import { getSession } from '@/lib/auth/session'
import {
  createBeneficiary,
  listAccounts,
  listBeneficiaries,
  listTransactions,
  removeBeneficiary,
  sendToBeneficiary,
} from '@/lib/psp/PspClient'
import {
  createContactEnrichment,
  createTransactionEnrichment,
  deleteContactEnrichment,
  listContactEnrichment,
  listTransactionEnrichment,
} from '@/lib/backend/enrichment'
import { avatarFor, formatDate, formatMoney } from './format'

async function ownerRef() {
  const session = await getSession()
  return session?.sub ?? null
}

/** Last 4 visible digits of a masked IBAN, for the account card. */
function last4Of(maskedIban) {
  const digits = String(maskedIban ?? '').replace(/\D/g, '')
  return digits.slice(-4) || '••••'
}

/** The user's accounts (balance, masked IBAN, currency), UI-ready. */
export async function getAccounts() {
  const accounts = await listAccounts()
  return accounts.map((a) => ({
    reference: a.reference,
    label: a.label,
    currency: a.currency,
    maskedIban: a.maskedIban,
    last4: last4Of(a.maskedIban),
    amount: formatMoney(a.balanceValue),
    balanceValue: a.balanceValue,
    isDefault: a.isDefault,
  }))
}

/** Shape a Leafy Pay beneficiary into the UI contact used across the app. */
function toContactView(b) {
  return {
    id: b.reference,
    reference: b.reference,
    name: b.label,
    lookupType: b.lookupType,
    lookupHint: b.lookupHint,
    ...avatarFor(b.reference ?? b.label),
  }
}

/** The user's contacts (Leafy Pay beneficiaries), UI-ready. */
export async function getContacts() {
  const beneficiaries = await listBeneficiaries()
  return beneficiaries.map(toContactView)
}

/**
 * Add a contact: resolve a registered Leafy Pay email/phone into a saved beneficiary (source of truth),
 * then mirror it to the Atlas walletContacts replica (best-effort). Fails cleanly if no registered
 * user/merchant matches the given email/phone.
 * @param {{lookupType: 'email'|'phone', lookupValue: string, label?: string}} input
 * @returns {Promise<{ok: boolean, contact?: object, error?: string}>}
 */
export async function addContact({ lookupType, lookupValue, label = '' } = {}) {
  const value = String(lookupValue ?? '').trim()
  if (!value) return { ok: false, error: 'Enter an email or phone number' }

  let result
  try {
    result = await createBeneficiary({ lookupType, lookupValue: value, label: label.trim() })
  } catch {
    return { ok: false, error: 'Could not add contact. Please try again.' }
  }
  if (!result.found) {
    const kind = lookupType === 'phone' ? 'phone number' : 'email'
    return { ok: false, error: `No Leafy Pay user is registered with that ${kind}.` }
  }
  const beneficiary = result.beneficiary

  const owner = await ownerRef()
  if (owner) {
    await createContactEnrichment({
      ownerPartyRef: owner,
      counterpartyArrangementReference: beneficiary.reference,
      counterpartyLabel: beneficiary.label,
      counterpartyLookupType: beneficiary.lookupType,
      counterpartyLookupHint: beneficiary.lookupHint,
    }).catch(() => {})
  }

  return { ok: true, contact: toContactView(beneficiary) }
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

/**
 * The user's transactions: Leafy Pay (base transfer, source of truth) read in parallel with the Atlas
 * enrichment (note + embedding), merged by `leafyPayTransferReference`. Counterparty name resolved from
 * the beneficiary list. Sorted newest first.
 */
export async function getTransactions() {
  const owner = await ownerRef()
  const [transactions, beneficiaries, enrichment] = await Promise.all([
    listTransactions(),
    listBeneficiaries().catch(() => []),
    owner ? listTransactionEnrichment(owner).catch(() => []) : [],
  ])
  const contactByRef = new Map(beneficiaries.map((b) => [b.reference, b]))
  const enrichByRef = new Map((enrichment ?? []).map((e) => [e.leafyPayTransferReference, e]))

  const rows = transactions.map((t) => {
    const contact = contactByRef.get(t.counterpartyReference)
    const enrich = enrichByRef.get(t.reference)
    const magnitude = Math.abs(t.value)
    return {
      id: t.reference,
      reference: t.reference,
      name: contact?.label ?? t.beneficiaryName ?? t.destinationMasked ?? 'Payment',
      lookupHint: contact?.lookupHint ?? t.destinationMasked ?? '',
      // Note lives in the Atlas enrichment layer; fall back to Leafy Pay's remittance if none.
      note: enrich?.note ?? t.note ?? '',
      amount: t.direction === 'received' ? magnitude : -magnitude,
      currency: t.currency,
      date: formatDate(t.createdAt),
      createdAt: t.createdAt,
      status: t.status,
      isPending: t.status !== 'completed',
      ...avatarFor(t.counterpartyReference ?? t.reference),
    }
  })

  rows.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
  return rows
}

/**
 * Send a P2P transfer: Leafy Pay moves the money (base), then the note is written to Atlas in parallel
 * so it gets embedded for search. The Atlas write is best-effort (money already moved).
 * @param {{counterpartyArrangementReference: string, amount: number, note?: string}} input
 * @returns {Promise<{ok: boolean, reference?: string, status?: string, error?: string}>}
 */
export async function sendMoney({ counterpartyArrangementReference, amount, note = '' }) {
  if (!counterpartyArrangementReference || !(amount > 0)) {
    return { ok: false, error: 'A recipient and an amount are required' }
  }
  let transfer
  try {
    transfer = await sendToBeneficiary(counterpartyArrangementReference, { amount, note })
  } catch (e) {
    return { ok: false, error: e?.body || 'Transfer failed. Please try again.' }
  }

  const owner = await ownerRef()
  if (transfer.reference && owner) {
    // Best-effort: the money has moved regardless of whether the note gets embedded.
    await createTransactionEnrichment({
      leafyPayTransferReference: transfer.reference,
      ownerPartyRef: owner,
      counterpartyArrangementReference,
      amount: { value: amount, currency: 'EUR' },
      note: note || null,
      direction: 'sent',
      leafyPayStatus: transfer.status === 'completed' ? 'settled' : 'pending',
    }).catch(() => {})
  }

  return { ok: true, reference: transfer.reference, status: transfer.status }
}
