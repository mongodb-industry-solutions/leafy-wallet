import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ENV } from './env'

// Cache the discovery doc + JWKS for the process lifetime (they rarely change).
let discoveryCache = null
let jwksCache = null

/** Fetch (and cache) Leafy Pay's OIDC discovery document. */
export async function discover() {
  if (discoveryCache) return discoveryCache
  const res = await fetch(`${ENV.pspBaseUrl()}/.well-known/openid-configuration`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`)
  discoveryCache = await res.json()
  return discoveryCache
}

function jwks(jwksUri) {
  if (!jwksCache) jwksCache = createRemoteJWKSet(new URL(jwksUri))
  return jwksCache
}

const b64url = (buf) => buf.toString('base64url')

/** PKCE S256 verifier + challenge (RFC 7636). */
export function generatePkce() {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

/** Random base64url token, used for the OAuth state and nonce values. */
export const randomToken = () => b64url(randomBytes(16))

// Confidential client auth via HTTP Basic (client_secret_basic).
function basicAuthHeader() {
  const creds = Buffer.from(`${ENV.clientId()}:${ENV.clientSecret()}`).toString('base64')
  return `Basic ${creds}`
}

/** Build the browser-facing authorize URL from the discovered authorization endpoint. */
export async function buildAuthorizeUrl({ state, nonce, codeChallenge, scopes }) {
  const cfg = await discover()
  const u = new URL(cfg.authorization_endpoint)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', ENV.clientId())
  u.searchParams.set('redirect_uri', ENV.redirectUri())
  u.searchParams.set('scope', scopes.join(' '))
  u.searchParams.set('state', state)
  u.searchParams.set('nonce', nonce)
  u.searchParams.set('code_challenge', codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

/** Exchange an authorization code for tokens (authorization_code + PKCE). */
export async function exchangeCode(code, codeVerifier) {
  const cfg = await discover()
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
    const err = await res.json().catch(() => ({}))
    throw new Error(`token exchange failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}

/** Refresh tokens via grant_type=refresh_token. */
export async function refreshTokens(refreshToken) {
  const cfg = await discover()
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

function backchannelEndpoint(cfg) {
  return cfg.backchannel_authentication_endpoint ?? cfg.token_endpoint.replace(/\/token$/, '/bc-authorize')
}

/** Initiate the CIBA backchannel request and return { auth_req_id, expires_in, interval }. */
export async function backchannelAuthorize({ loginHintToken, scope, bindingMessage }) {
  const cfg = await discover()
  const body = new URLSearchParams({ login_hint_token: loginHintToken, scope, client_id: ENV.clientId() })
  if (bindingMessage) body.set('binding_message', bindingMessage)
  const res = await fetch(backchannelEndpoint(cfg), {
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
  const cfg = await discover()
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

/** Best-effort token revocation (RFC 7009). */
export async function revoke(token) {
  const cfg = await discover()
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
    const cfg = await discover()
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

/** Verify id_token (signature via JWKS, issuer/audience, and nonce if one was issued). */
export async function verifyIdToken(idToken, expectedNonce) {
  const cfg = await discover()
  const { payload } = await jwtVerify(idToken, jwks(cfg.jwks_uri), {
    issuer: cfg.issuer,
    audience: ENV.clientId(),
  })
  // A missing nonce when one was expected is a mismatch, not a pass (OIDC Core 3.1.3.7).
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('id_token nonce mismatch')
  }
  return { sub: payload.sub, name: payload.name, email: payload.email }
}
