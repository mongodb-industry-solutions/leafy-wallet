'use server'

import { getSession } from '@/lib/auth/session'
import { listAccounts, listBeneficiaries, listTransactions } from '@/lib/psp/PspClient'
import { listTransactionEnrichment } from '@/lib/backend/enrichment'
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
    last4: last4Of(a.maskedIban),
    amount: formatMoney(a.balanceValue),
    balanceValue: a.balanceValue,
    isDefault: a.isDefault,
  }))
}

/** The user's contacts (Leafy Pay beneficiaries), UI-ready. */
export async function getContacts() {
  const beneficiaries = await listBeneficiaries()
  return beneficiaries.map((b) => ({
    id: b.reference,
    reference: b.reference,
    name: b.label,
    lookupType: b.lookupType,
    lookupHint: b.lookupHint,
    ...avatarFor(b.reference ?? b.label),
  }))
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
