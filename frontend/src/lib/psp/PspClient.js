import 'server-only'
import { ENV } from '@/lib/auth/env'
import { getSession, setSession } from '@/lib/auth/session'
import { refreshTokens } from '@/lib/auth/oauth'

/** Error from a Leafy Pay request, carrying the HTTP status. */
class PspError extends Error {
  constructor(status, body) {
    super(`Leafy Pay request failed: ${status}`)
    this.name = 'PspError'
    this.status = status
    this.body = body
  }
}

// Call Leafy Pay with a Bearer token; on 401 refresh once and retry with the rotated token.
async function pspRequest(method, path, body, token, refreshToken, extraHeaders, retried = false) {
  const res = await fetch(`${ENV.pspBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (res.status === 401 && !retried && refreshToken) {
    let tokens
    try {
      tokens = await refreshTokens(refreshToken)
    } catch {
      throw new PspError(401, 'session expired')
    }
    const session = await getSession()
    if (session) {
      await setSession({
        ...session,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? refreshToken,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      }).catch(() => {})
    }
    return pspRequest(
      method,
      path,
      body,
      tokens.access_token,
      tokens.refresh_token ?? refreshToken,
      extraHeaders,
      true,
    )
  }
  if (!res.ok) throw new PspError(res.status, await res.text().catch(() => ''))
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

/**
 * `idempotencyKey` guards the writes that must not double-fire on a retry (create, accept): Leafy
 * Pay replays the original result instead of acting twice.
 */
async function call(method, path, body, idempotencyKey) {
  const session = await getSession()
  if (!session) throw new PspError(401, 'not_authenticated')
  const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  return pspRequest(method, path, body, session.accessToken, session.refreshToken, headers)
}

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

function normalizeBeneficiary(b) {
  return {
    reference: b.counterpartyArrangementReference,
    label: b.counterpartyLabel ?? 'Beneficiary',
    lookupType: b.counterpartyLookupType ?? 'email',
    lookupHint: b.counterpartyLookupHint ?? '••••',
    status: b.counterpartyArrangementStatus ?? 'active',
  }
}

function normalizeTransaction(t) {
  const gross = t.grossAmount ?? t.paymentExecutionAmount?.amount ?? 0
  return {
    reference: t.paymentExecutionInstanceReference ?? t.transferReference,
    counterpartyReference: t.beneficiaryArrangementReference ?? t.counterpartyArrangementReference ?? null,
    direction: t.direction ?? 'sent',
    value: typeof gross === 'number' ? gross : (gross?.amount ?? 0),
    currency: t.currency ?? 'EUR',
    status: t.paymentExecutionStatus ?? t.status ?? 'pending',
    note: t.concept ?? t.paymentExecutionRemittanceInformation ?? t.description ?? '',
    createdAt: t.completedAt ?? t.initiatedAt ?? t.scheduledAt ?? t.recordCreatedDateTime ?? null,
  }
}

/**
 * Shape a Leafy Pay request into the flat form the wallet stores and renders. `status` stays raw:
 * Leafy Pay owns the lifecycle, so collapsing it for display happens in `lib/wallet/requests.js`.
 */
function normalizeRtpRequest(r) {
  return {
    reference: r.paymentRequestInstanceReference,
    payeePartyRef: r.requesterPartyReference ?? '',
    payeeName: r.payeeName ?? '',
    payerPartyRef: r.payerPartyReference ?? '',
    payerCounterpartyRef: r.payerCounterpartyReference ?? '',
    amount: typeof r.amount === 'number' ? r.amount : 0,
    currency: r.currency ?? 'EUR',
    note: r.purpose ?? '',
    status: r.status ?? 'created',
    executionReference: r.linkedPaymentExecutionReference ?? null,
    createdAt: r.recordCreatedDateTime ?? null,
    updatedAt: r.recordUpdatedDateTime ?? null,
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────
/** The signed-in user's payout accounts (scope `read:accounts`). */
export async function listAccounts() {
  const data = await call('GET', '/api/v1/accounts')
  return (data.results ?? []).map(normalizeAccount)
}

/** The user's active saved beneficiaries (scope `read:beneficiaries`). */
export async function listBeneficiaries() {
  const data = await call('GET', '/api/v1/beneficiaries')
  return (data.results ?? []).map(normalizeBeneficiary).filter((b) => b.status !== 'removed')
}

/** The user's transaction history (payment executions, scope `read:transactions`). */
export async function listTransactions() {
  const data = await call('GET', '/api/v1/transactions')
  return (data.results ?? []).map(normalizeTransaction)
}

// ── Writes ───────────────────────────────────────────────────────────────────
/**
 * Save a beneficiary by resolving a registered Leafy Pay email/phone (scope `write:beneficiaries`).
 * @returns {Promise<{found: boolean, beneficiary?: object}>}
 */
export async function createBeneficiary({ lookupType, lookupValue, label }) {
  const body = { lookupType, lookupValue, ...(label ? { label } : {}) }
  const data = await call('POST', '/api/v1/beneficiaries', body)
  if (!data?.found) return { found: false }
  return {
    found: true,
    beneficiary: {
      reference: data.counterpartyArrangementReference,
      label: data.counterpartyLabel,
      lookupType,
      lookupHint: data.counterpartyLookupHint ?? '••••',
      status: 'active',
    },
  }
}

/** Remove a saved beneficiary (scope `write:beneficiaries`). */
export async function removeBeneficiary(reference) {
  await call('DELETE', `/api/v1/beneficiaries/${encodeURIComponent(reference)}`)
}

/**
 * Send a P2P transfer to a saved beneficiary (scope `write:transfers`). Omitting `fromAccountRef` lets
 * Leafy Pay draw from the default account. Returns `submitted` while settling (async, T+N).
 */
export async function sendToBeneficiary(reference, { amount, currency = 'EUR', note, fromAccountRef }) {
  const body = {
    amount,
    currency,
    ...(note ? { note } : {}),
    ...(fromAccountRef ? { fromAccountRef } : {}),
  }
  const r = await call('POST', `/api/v1/beneficiaries/${encodeURIComponent(reference)}/transfer`, body)
  return {
    reference: r.transferReference ?? r.paymentExecutionInstanceReference ?? null,
    status: r.status ?? r.paymentExecutionStatus ?? 'pending',
  }
}

// ── Request to Pay (scopes `read:rtp` / `write:rtp`) ──────────────────────────
// A request is its own record, separate from the transfer that settles it: only once the payer
// approves does Leafy Pay create the linked payment. The payer is addressed by a saved beneficiary.

const RTP_BASE = '/api/v1/gateway/rtp/requests'

/**
 * Raise a request against a saved beneficiary. Leafy Pay resolves the payer from it, and the
 * destination from the requester's default account.
 * @param {{payerCounterpartyRef: string, amount: number, currency?: string, note?: string, idempotencyKey?: string}} input
 */
export async function createRtpRequest({
  payerCounterpartyRef,
  amount,
  currency = 'EUR',
  note,
  idempotencyKey,
}) {
  const body = {
    amount,
    currency,
    payerCounterpartyReference: payerCounterpartyRef,
    ...(note ? { purpose: note } : {}),
  }
  return normalizeRtpRequest(await call('POST', RTP_BASE, body, idempotencyKey))
}

/**
 * Deliver a created request to the payer. Leafy Pay keeps creation and presentation separate, so a
 * request is only live once this has run.
 */
export async function presentRtpRequest(reference) {
  return normalizeRtpRequest(
    await call('POST', `${RTP_BASE}/${encodeURIComponent(reference)}/present`, {}),
  )
}

/**
 * The user's requests: `inbox` are addressed to them (they would pay), `outbox` are ones they raised.
 * @param {'inbox'|'outbox'} box
 */
export async function listRtpRequests(box) {
  const data = await call('GET', `${RTP_BASE}?box=${box}`)
  return (data.results ?? []).map(normalizeRtpRequest)
}

/**
 * Approve a request: Leafy Pay screens it, holds the funds and creates the payment. Returns
 * `accepted` with that payment's reference, or a reason it was blocked.
 * @returns {Promise<{status: string, executionReference: string|null, reason: string|null}>}
 */
export async function acceptRtpRequest(reference, { fromAccountRef, idempotencyKey } = {}) {
  const body = fromAccountRef ? { fundingAccountRef: fromAccountRef } : {}
  const r = await call(
    'POST',
    `${RTP_BASE}/${encodeURIComponent(reference)}/accept`,
    body,
    idempotencyKey,
  )
  return {
    status: r.status ?? 'failed',
    executionReference: r.executionReference ?? null,
    reason: r.reason ?? null,
  }
}

/** Decline a request addressed to the user. */
export async function rejectRtpRequest(reference) {
  return normalizeRtpRequest(
    await call('POST', `${RTP_BASE}/${encodeURIComponent(reference)}/reject`, {}),
  )
}

/** Withdraw a request the user raised. */
export async function cancelRtpRequest(reference) {
  return normalizeRtpRequest(
    await call('POST', `${RTP_BASE}/${encodeURIComponent(reference)}/cancel`, {}),
  )
}
