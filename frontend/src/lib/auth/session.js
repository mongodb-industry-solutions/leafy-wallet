import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { ENV } from './env'

const COOKIE_NAME = 'lw_session'
const LOGIN_COOKIE = 'lw_login'
const ALG = 'aes-256-gcm'

/** Derive a fixed 32-byte key from the configured session secret. */
function key() {
  return createHash('sha256').update(ENV.sessionSecret()).digest()
}

function encrypt(payload) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, key(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`
}

function decrypt(blob) {
  try {
    const [ivB, tagB, dataB] = blob.split('.')
    if (!ivB || !tagB || !dataB) return null
    const decipher = createDecipheriv(ALG, key(), Buffer.from(ivB, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
    const out = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()])
    return JSON.parse(out.toString('utf8'))
  } catch {
    return null // tampered or wrong key → treat as no session
  }
}

const secureCookie = () => ENV.appBaseUrl().startsWith('https')
const sessionCookieOpts = () => ({ httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
const loginCookieOpts = () => ({ httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 600 })

/**
 * The decrypted session, or null. Shape: { accessToken, refreshToken, idToken, expiresAt,
 * grantedScopes, sub, name, email }.
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  const c = (await cookies()).get(COOKIE_NAME)
  return c ? decrypt(c.value) : null
}

/** Write the encrypted session cookie (mutating contexts only: server actions / route handlers). */
export async function setSession(session) {
  ;(await cookies()).set(COOKIE_NAME, encrypt(session), sessionCookieOpts())
}

/** Attach the session cookie to a NextResponse (use on returned redirects). */
export function attachSession(res, session) {
  res.cookies.set(COOKIE_NAME, encrypt(session), sessionCookieOpts())
}

/** Delete the session cookie via next/headers. */
export async function clearSession() {
  ;(await cookies()).delete(COOKIE_NAME)
}

/** Expire the session cookie on a returned NextResponse. */
export function clearSessionOn(res) {
  res.cookies.set(COOKIE_NAME, '', { ...sessionCookieOpts(), maxAge: 0 })
}

// Transient login state (PKCE + CSRF): { state, nonce, codeVerifier }.
/** Attach the short-lived login-state cookie to a NextResponse. */
export function attachLoginState(res, s) {
  res.cookies.set(LOGIN_COOKIE, encrypt(s), loginCookieOpts())
}

/** Read the login-state from the incoming request (no mutation). */
export function readLoginState(req) {
  const c = req.cookies.get(LOGIN_COOKIE)
  return c ? decrypt(c.value) : null
}

/** Expire the login-state cookie on a returned NextResponse. */
export function clearLoginStateOn(res) {
  res.cookies.set(LOGIN_COOKIE, '', { ...loginCookieOpts(), maxAge: 0 })
}

/** Whether a granted scope is present on the session. */
export function hasScope(session, scope) {
  return !!session?.grantedScopes?.includes(scope)
}
