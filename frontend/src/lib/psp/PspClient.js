import 'server-only'
import { ENV } from '@/lib/auth/env'
import { getSession, setSession } from '@/lib/auth/session'
import { refreshTokens } from '@/lib/auth/oauth'

/** Error from a Leafy Pay request, carrying the HTTP status. */
export class PspError extends Error {
  constructor(status, body) {
    super(`Leafy Pay request failed: ${status}`)
    this.name = 'PspError'
    this.status = status
    this.body = body
  }
}

// GET Leafy Pay with a Bearer token; on 401 refresh once and retry with the rotated token.
async function pspGet(path, token, refreshToken, retried = false) {
  const res = await fetch(`${ENV.pspBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 401 && !retried && refreshToken) {
    let tokens
    try {
      tokens = await refreshTokens(refreshToken)
    } catch {
      throw new PspError(401, 'session expired')
    }
    // Persist the rotated token so later requests in this session reuse it.
    const session = await getSession()
    if (session) {
      await setSession({
        ...session,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? refreshToken,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      }).catch(() => {})
    }
    return pspGet(path, tokens.access_token, tokens.refresh_token ?? refreshToken, true)
  }
  if (!res.ok) throw new PspError(res.status, await res.text().catch(() => ''))
  return res.json()
}

async function get(path) {
  const session = await getSession()
  if (!session) throw new PspError(401, 'not_authenticated')
  return pspGet(path, session.accessToken, session.refreshToken)
}

// Field names from docs/technical-spec.md §1.17 (BIAN SD-54/65/66). Alternate keys are kept as
// defensive fallbacks where the OAuth-channel response may differ from the raw record.

// payoutAccountArrangement (SD-66). The masked IBAN is plaintext in list views; the raw IBAN is stripped.
function normalizeAccount(a) {
  const bal = a.payoutAccountBalance ?? {}
  return {
    reference: a.payoutAccountInstanceReference,
    label: a.payoutAccountAlias ?? a.payoutAccountBankName ?? 'EUR account',
    currency: a.payoutAccountCurrency ?? bal.currency ?? 'EUR',
    maskedIban: a.payoutAccountMaskedIban ?? null,
    isDefault: Boolean(a.payoutAccountIsDefault),
    balanceValue: bal.availableAmount ?? 0,
  }
}

// counterpartyArrangement (SD-54). Raw phone/email is never returned, only the masked hint.
function normalizeBeneficiary(b) {
  return {
    reference: b.counterpartyArrangementReference,
    label: b.counterpartyLabel ?? 'Beneficiary',
    lookupType: b.counterpartyLookupType ?? 'email',
    lookupHint: b.counterpartyLookupHint ?? '••••',
    status: b.counterpartyArrangementStatus ?? 'active',
  }
}

// paymentExecutionProcedure (SD-65). The P2P note is `paymentExecutionRemittanceInformation`.
function normalizeTransaction(t) {
  const gross = t.grossAmount ?? t.paymentExecutionAmount?.amount ?? 0
  return {
    reference: t.paymentExecutionInstanceReference ?? t.transferReference,
    counterpartyReference: t.beneficiaryArrangementReference ?? t.counterpartyArrangementReference ?? null,
    beneficiaryName: t.beneficiaryName ?? null,
    destinationMasked: t.destinationAccountMasked ?? null,
    direction: t.direction ?? 'sent',
    value: typeof gross === 'number' ? gross : (gross?.amount ?? 0),
    currency: t.currency ?? 'EUR',
    status: t.paymentExecutionStatus ?? t.status ?? 'pending',
    note: t.paymentExecutionRemittanceInformation ?? t.description ?? '',
    createdAt: t.completedAt ?? t.initiatedAt ?? t.scheduledAt ?? t.recordCreatedDateTime ?? null,
  }
}

/** The signed-in user's payout accounts (scope `read:accounts`). */
export async function listAccounts() {
  const data = await get('/api/v1/accounts')
  return (data.results ?? []).map(normalizeAccount)
}

/** The user's active saved beneficiaries (scope `read:beneficiaries`). */
export async function listBeneficiaries() {
  const data = await get('/api/v1/beneficiaries')
  return (data.results ?? []).map(normalizeBeneficiary).filter((b) => b.status !== 'removed')
}

/** The user's transaction history (payment executions, scope `read:transactions`). */
export async function listTransactions() {
  const data = await get('/api/v1/transactions')
  return (data.results ?? []).map(normalizeTransaction)
}
