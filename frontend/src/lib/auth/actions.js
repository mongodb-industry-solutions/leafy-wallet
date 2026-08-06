'use server'

import { randomInt } from 'crypto'
import { ENV, REQUESTED_SCOPES } from './env'
import { getSession, setSession } from './session'
import {
  backchannelAuthorize,
  cibaTokenPoll,
  fetchUserinfo,
  verifyIdToken,
  displayNameFrom,
  OAuthUpstreamError,
} from './oauth'

// Leafy Pay mints auth_req_ids from this alphabet; anything else never reaches the upstream.
const AUTH_REQ_ID_PATTERN = /^[A-Za-z0-9._-]+$/

/** Relay a request to Leafy Pay and return { res, data } with the body parsed as JSON. */
async function pspFetch(path, init = {}) {
  const res = await fetch(`${ENV.pspBaseUrl()}${path}`, { cache: 'no-store', ...init })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { res, data }
}

/** Current identity from the session cookie, or null. */
export async function me() {
  const session = await getSession()
  if (!session) return null
  return { sub: session.sub, name: session.name, email: session.email }
}

// Passwordless enrollment. Session-gated relays with the Bearer attached server-side.
/** Get an enrollment challenge from Leafy Pay for the logged-in user. */
export async function enrollChallenge() {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not_authenticated' }
  const { res, data } = await pspFetch('/api/v1/auth/enroll/challenge', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) return { ok: false, error: data.error_description ?? data.error ?? `enroll_challenge_failed_${res.status}` }
  return { ok: true, ...data }
}

/** Register the browser's public key at Leafy Pay. */
export async function enroll(body) {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not_authenticated' }
  const { res, data } = await pspFetch('/api/v1/auth/enroll', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: data.error_description ?? data.error ?? `enroll_failed_${res.status}` }
  return { ok: true, ...data }
}

// CIBA passwordless login. Session-less relays where the signature is the authentication.
/** Begin the backchannel request and return { auth_req_id, interval, expires_in, binding_message }. */
export async function cibaStart({ login_hint_token: loginHintToken } = {}) {
  if (!loginHintToken) return { ok: false, error: 'invalid_request' }
  const bindingMessage = `Leafy Wallet ${randomInt(1000, 9999)}`
  try {
    const r = await backchannelAuthorize({
      loginHintToken,
      scope: REQUESTED_SCOPES.join(' '),
      bindingMessage,
    })
    return { ok: true, ...r, binding_message: bindingMessage }
  } catch (e) {
    if (e instanceof OAuthUpstreamError) return { ok: false, error: e.code, error_description: e.description }
    return { ok: false, error: 'bc_authorize_failed', error_description: 'Could not reach Leafy Pay' }
  }
}

/** Fetch the challenge + binding message for a pending backchannel request. */
export async function cibaChallenge(authReqId) {
  if (!authReqId || !AUTH_REQ_ID_PATTERN.test(authReqId)) return { ok: false, error: 'invalid auth_req_id' }
  const { res, data } = await pspFetch(`/api/v1/auth/bc-authorize/${encodeURIComponent(authReqId)}`)
  if (!res.ok) return { ok: false, error: data.error_description ?? data.error }
  return { ok: true, ...data }
}

/** Submit the signed assertion. On 401/400 the caller should treat the credential as revoked. */
export async function cibaApprove({ auth_req_id: authReqId, credentialId, signature } = {}) {
  if (!authReqId || !credentialId || !signature) return { ok: false, status: 400, error: 'missing fields' }
  if (!AUTH_REQ_ID_PATTERN.test(authReqId)) return { ok: false, status: 400, error: 'invalid auth_req_id' }
  const { res, data } = await pspFetch(`/api/v1/auth/bc-authorize/${encodeURIComponent(authReqId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId, signature }),
  })
  if (!res.ok) return { ok: false, status: res.status, error: data.error_description ?? data.error }
  return { ok: true }
}

/** Poll the ciba token grant. On success sets the session cookie and returns { status: 'done' }. */
export async function cibaPoll({ auth_req_id: authReqId } = {}) {
  if (!authReqId) return { status: 'error', error: 'auth_req_id required' }

  const result = await cibaTokenPoll(authReqId)
  if (result.status !== 'done' || !result.tokens) {
    return { status: result.status, error: result.error }
  }

  const tokens = result.tokens
  const grantedScopes = tokens.scope ? tokens.scope.split(' ').filter(Boolean) : []

  let sub = ''
  let idName
  let email
  try {
    if (tokens.id_token) {
      const claims = await verifyIdToken(tokens.id_token) // CIBA flow carries no nonce
      sub = claims.sub
      idName = claims.name
      email = grantedScopes.includes('email') ? claims.email : undefined
    }
  } catch {
    return { status: 'error', error: 'id_token verification failed' }
  }
  if (!sub) return { status: 'error', error: 'missing subject' }

  const info = await fetchUserinfo(tokens.access_token)
  const name = displayNameFrom(info, idName, email)

  await setSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    grantedScopes,
    sub,
    name,
    email,
  })
  return { status: 'done' }
}
