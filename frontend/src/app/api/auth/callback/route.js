// GET /api/auth/callback. Validates state, exchanges the code for tokens, verifies the id_token, sets the session.
import { NextResponse } from 'next/server'
import { exchangeCode, verifyIdToken, fetchUserinfo, displayNameFrom } from '@/lib/auth/oauth'
import { attachSession, clearLoginStateOn, readLoginState } from '@/lib/auth/session'
import { ENV } from '@/lib/auth/env'

/** Redirect back with an auth_error, expiring the transient login cookie. */
function fail(reason, returnTo = '/') {
  const home = new URL(returnTo, ENV.appBaseUrl())
  home.searchParams.set('auth_error', reason)
  const res = NextResponse.redirect(home)
  clearLoginStateOn(res)
  return res
}

export async function GET(req) {
  const { searchParams } = req.nextUrl

  const error = searchParams.get('error')
  if (error) return fail(error, readLoginState(req)?.returnTo || '/')

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const login = readLoginState(req)
  const returnTo = login?.returnTo || '/'

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
    if (!sub) return fail('token_exchange_failed', returnTo)

    const info = await fetchUserinfo(tokens.access_token)
    const name = displayNameFrom(info, idName, email)

    const res = NextResponse.redirect(new URL(returnTo, ENV.appBaseUrl()))
    attachSession(res, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      grantedScopes,
      sub,
      name,
      email,
    })
    clearLoginStateOn(res)
    return res
  } catch {
    return fail('token_exchange_failed', returnTo)
  }
}
