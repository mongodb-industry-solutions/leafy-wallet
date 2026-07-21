// GET /api/auth/callback. Validates state, exchanges the code for tokens, verifies the id_token, sets the session.
import { NextResponse } from 'next/server'
import { exchangeCode, verifyIdToken, fetchUserinfo } from '@/lib/auth/oauth'
import { attachSession, clearLoginStateOn, readLoginState } from '@/lib/auth/session'
import { ENV } from '@/lib/auth/env'

const localPart = (v) => (v && v.includes('@') ? v.split('@')[0] : v)

/** Redirect home with an auth_error, expiring the transient login cookie. */
function fail(reason) {
  const home = new URL('/', ENV.appBaseUrl())
  home.searchParams.set('auth_error', reason)
  const res = NextResponse.redirect(home)
  clearLoginStateOn(res)
  return res
}

export async function GET(req) {
  const { searchParams } = req.nextUrl

  const error = searchParams.get('error')
  if (error) return fail(error)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const login = readLoginState(req)

  if (!code || !login || !state || state !== login.state) return fail('invalid_state')

  try {
    const tokens = await exchangeCode(code, login.codeVerifier)
    const grantedScopes = tokens.scope ? tokens.scope.split(' ').filter(Boolean) : []

    let sub = ''
    let idName
    let email
    if (tokens.id_token) {
      const claims = await verifyIdToken(tokens.id_token, login.nonce)
      sub = claims.sub
      idName = claims.name
      // Only keep email if the email scope was actually granted (data minimization).
      email = grantedScopes.includes('email') ? claims.email : undefined
    }
    if (!sub) return fail('token_exchange_failed')

    const info = await fetchUserinfo(tokens.access_token)
    const name = info?.name ?? idName ?? localPart(info?.preferred_username) ?? localPart(email) ?? undefined

    const res = NextResponse.redirect(new URL('/', ENV.appBaseUrl()))
    attachSession(res, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      grantedScopes,
      sub,
      name,
      email,
    })
    clearLoginStateOn(res)
    return res
  } catch {
    return fail('token_exchange_failed')
  }
}
