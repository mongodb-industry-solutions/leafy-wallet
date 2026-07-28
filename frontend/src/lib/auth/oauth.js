import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ENV } from './env'

let jwksCache = null

// Leafy Pay's API endpoints on the backend host. The browser-facing authorize page is on the
// frontend host (see ENV.authorizeUrl).
function oidcConfig() {
  const base = ENV.pspBaseUrl()
  return {
    issuer: base,
    token_endpoint: `${base}/api/v1/auth/token`,
    userinfo_endpoint: `${base}/api/v1/auth/userinfo`,
    revocation_endpoint: `${base}/api/v1/auth/revoke`,
    jwks_uri: `${base}/api/v1/auth/jwks`,
    backchannel_authentication_endpoint: `${base}/api/v1/auth/bc-authorize`,
  }
}

function jwks(jwksUri) {
  if (!jwksCache) jwksCache = createRemoteJWKSet(new URL(jwksUri))
  return jwksCache
}

const b64url = (buf) => buf.toString('base64url')

/** PKCE S256 verifier + challenge. */
export function generatePkce() {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

/** Random base64url token, used for the OAuth state and nonce values. */
export const randomToken = () => b64url(randomBytes(16))

function basicAuthHeader() {
  const creds = Buffer.from(`${ENV.clientId()}:${ENV.clientSecret()}`).toString('base64')
  return `Basic ${creds}`
}

/**
 * Build the browser-facing authorize URL (Leafy Pay's frontend login page).
 * @param {object} params
 * @param {string} [params.prefillEmail] - Demo user's email, prefilled on Leafy Pay's login form.
 * @param {string} [params.prefillPassword] - Same demo user's password, prefilled alongside it.
 */
export function buildAuthorizeUrl({ state, nonce, codeChallenge, scopes, prefillEmail, prefillPassword }) {
  const u = new URL(ENV.authorizeUrl())
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', ENV.clientId())
  u.searchParams.set('redirect_uri', ENV.redirectUri())
  u.searchParams.set('scope', scopes.join(' '))
  u.searchParams.set('state', state)
  u.searchParams.set('nonce', nonce)
  u.searchParams.set('code_challenge', codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  // Demo convenience: hand Leafy Pay's login form both credentials so tapping a profile card lands on
  // a form that is already filled in. `login_hint` is standard OIDC; `prefill_password` is Leafy Pay's
  // own demo-only param (honoured unless its NEXT_PUBLIC_PSP_OIDC_AUTO kill-switch is 'false').
  // A password in a query string leaks into browser history, proxy logs and Referer headers, so only
  // the shared demo credential from DEMO_USERS ever goes here - never a real one. The visitor still
  // clicks the login button; Leafy Pay only auto-submits with an extra `auto_login=1`.
  if (prefillEmail) u.searchParams.set('login_hint', prefillEmail)
  if (prefillPassword) u.searchParams.set('prefill_password', prefillPassword)
  return u.toString()
}

/** Exchange an authorization code for tokens (authorization_code + PKCE). */
export async function exchangeCode(code, codeVerifier) {
  const cfg = oidcConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: ENV.redirectUri(),
    code_verifier: codeVerifier,
    client_id: ENV.clientId(),
  })
  const res = await fetch(cfg.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body,
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`token exchange failed: ${res.status} ${detail}`)
  }
  return res.json()
}

/** Refresh tokens via grant_type=refresh_token. */
export async function refreshTokens(refreshToken) {
  const cfg = oidcConfig()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: ENV.clientId(),
  })
  const res = await fetch(cfg.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`)
  return res.json()
}

// CIBA passwordless login.

/** Error carrying Leafy Pay's OAuth error code and description so callers can render clean UX. */
export class OAuthUpstreamError extends Error {
  constructor(code, description, status) {
    super(description || code)
    this.name = 'OAuthUpstreamError'
    this.code = code
    this.description = description
    this.status = status
  }
}


/** Initiate the CIBA backchannel request and return { auth_req_id, expires_in, interval }. */
export async function backchannelAuthorize({ loginHintToken, scope, bindingMessage }) {
  const cfg = oidcConfig()
  const body = new URLSearchParams({ login_hint_token: loginHintToken, scope, client_id: ENV.clientId() })
  if (bindingMessage) body.set('binding_message', bindingMessage)
  const res = await fetch(cfg.backchannel_authentication_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body,
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new OAuthUpstreamError(err.error ?? 'bc_authorize_failed', err.error_description ?? '', res.status)
  }
  return res.json()
}

/**
 * Poll the token endpoint once with the ciba grant.
 * @returns {Promise<{status: 'done'|'pending'|'slow_down'|'denied'|'expired'|'error', tokens?: object, error?: string}>}
 */
export async function cibaTokenPoll(authReqId) {
  const cfg = oidcConfig()
  const res = await fetch(cfg.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body: new URLSearchParams({
      grant_type: 'urn:openid:params:grant-type:ciba',
      auth_req_id: authReqId,
      client_id: ENV.clientId(),
    }),
    cache: 'no-store',
  })
  if (res.ok) return { status: 'done', tokens: await res.json() }
  const err = await res.json().catch(() => ({}))
  switch (err.error) {
    case 'authorization_pending':
      return { status: 'pending' }
    case 'slow_down':
      return { status: 'slow_down' }
    case 'access_denied':
      return { status: 'denied' }
    case 'expired_token':
      return { status: 'expired' }
    default:
      return { status: 'error', error: err.error_description ?? err.error ?? `token poll failed: ${res.status}` }
  }
}

/** Best-effort token revocation. */
export async function revoke(token) {
  const cfg = oidcConfig()
  await fetch(cfg.revocation_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body: new URLSearchParams({ token }),
    cache: 'no-store',
  }).catch(() => undefined)
}

/**
 * Call UserInfo with a fresh access token (at callback time, before a session exists). Returns only
 * the claims the granted scopes allow. Non-fatal: resolves to null so login can proceed on id_token alone.
 */
export async function fetchUserinfo(accessToken) {
  try {
    const cfg = oidcConfig()
    const res = await fetch(cfg.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** Verify id_token (signature via JWKS, audience, and nonce if one was issued). */
export async function verifyIdToken(idToken, expectedNonce) {
  const cfg = oidcConfig()
  // Issuer isn't enforced: the JWKS signature already proves the token came from Leafy Pay.
  const { payload } = await jwtVerify(idToken, jwks(cfg.jwks_uri), { audience: ENV.clientId() })
  // A missing nonce when one was expected is a mismatch, not a pass.
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('id_token nonce mismatch')
  }
  return { sub: payload.sub, name: payload.name, email: payload.email }
}
