// GET /api/auth/login. Starts authorization_code with PKCE and redirects to Leafy Pay's login page.
import { NextResponse } from 'next/server'
import { buildAuthorizeUrl, generatePkce, randomToken } from '@/lib/auth/oauth'
import { attachLoginState } from '@/lib/auth/session'
import { REQUESTED_SCOPES } from '@/lib/auth/env'
import { DEMO_USERS } from '@/lib/demo-users'

export async function GET(request) {
  const { verifier, challenge } = generatePkce()
  const state = randomToken()
  const nonce = randomToken()

  // Optional ?user=<email>: prefill that demo user's credentials on Leafy Pay's login form. Only the
  // email travels from the browser, and it is matched against DEMO_USERS rather than passed straight
  // through - so the password comes from this repo's demo config, never from the request.
  const email = new URL(request.url).searchParams.get('user')
  const demoUser = email ? DEMO_USERS.find((u) => u.email === email) : undefined

  const url = buildAuthorizeUrl({
    state,
    nonce,
    codeChallenge: challenge,
    scopes: REQUESTED_SCOPES,
    prefillEmail: demoUser?.email,
    prefillPassword: demoUser?.password,
  })

  // Set the short-lived encrypted PKCE/CSRF cookie directly on the redirect response.
  const res = NextResponse.redirect(url)
  attachLoginState(res, { state, nonce, codeVerifier: verifier })
  return res
}
