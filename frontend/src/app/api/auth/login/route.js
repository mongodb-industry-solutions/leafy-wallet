// GET /api/auth/login — start authorization_code + PKCE, redirect to Leafy Pay's login page.
import { NextResponse } from 'next/server'
import { buildAuthorizeUrl, generatePkce, randomToken } from '@/lib/auth/oauth'
import { attachLoginState } from '@/lib/auth/session'
import { REQUESTED_SCOPES } from '@/lib/auth/env'

export async function GET() {
  const { verifier, challenge } = generatePkce()
  const state = randomToken()
  const nonce = randomToken()

  const url = await buildAuthorizeUrl({ state, nonce, codeChallenge: challenge, scopes: REQUESTED_SCOPES })

  // Set the short-lived encrypted PKCE/CSRF cookie directly on the redirect response.
  const res = NextResponse.redirect(url)
  attachLoginState(res, { state, nonce, codeVerifier: verifier })
  return res
}
