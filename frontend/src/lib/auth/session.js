import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { ENV } from './env'

const COOKIE_NAME = 'lw_session'
const LOGIN_COOKIE = 'lw_login'
const DEVICE_COOKIE = 'lw_device'
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
    return null // tampered or wrong key, treat as no session
  }
}

const secureCookie = () => ENV.appBaseUrl().startsWith('https')
const sessionCookieOpts = () => ({ httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
const loginCookieOpts = () => ({ httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 600 })
const deviceCookieOpts = () => ({ httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })

/**
 * Stable id for this browser, minted on first use and outliving the session. Two demo attendees
 * signed in as the same test user share an `ownerPartyRef`, so this is what keeps one of them
 * reconnecting from replaying the other's queued offline sends.
 *
 * Mutating contexts only (server actions / route handlers) - a render pass cannot set cookies.
 * @returns {Promise<string>}
 */
export async function getDeviceRef() {
  const jar = await cookies()
  const existing = jar.get(DEVICE_COOKIE)?.value
  if (existing) return existing
  const minted = randomBytes(16).toString('base64url')
  jar.set(DEVICE_COOKIE, minted, deviceCookieOpts())
  return minted
}

/**
 * The decrypted session, or null. Shape: { accessToken, refreshToken, idToken, grantedScopes,
 * sub, name, email }.
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

/** Expire the session cookie on a returned NextResponse. */
export function clearSessionOn(res) {
  // sameSite repeats what the opts already set: scanners cannot see it through the spread.
  res.cookies.set(COOKIE_NAME, '', { ...sessionCookieOpts(), sameSite: 'lax', maxAge: 0 })
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
  // sameSite repeats what the opts already set: scanners cannot see it through the spread.
  res.cookies.set(LOGIN_COOKIE, '', { ...loginCookieOpts(), sameSite: 'lax', maxAge: 0 })
}
