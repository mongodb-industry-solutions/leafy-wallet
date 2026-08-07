// GET /api/auth/logout. Single sign-out: bumps the Leafy Pay session epoch, revokes our tokens, then
// clears the cookie. No front-channel through Leafy Pay's logout page, which ignores a post-logout
// redirect to localhost and would strand the user on the PSP frontend.
import { NextResponse } from 'next/server'
import { getSession, clearSessionOn } from '@/lib/auth/session'
import { revoke } from '@/lib/auth/oauth'
import { ENV } from '@/lib/auth/env'
import { safeReturnPath } from '@/lib/auth/return-path'

async function pspSessionLogout(accessToken) {
  try {
    await fetch(`${ENV.pspBaseUrl()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
  } catch {
    /* ignore */
  }
}

async function handle(request) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get('return'))
  const session = await getSession()
  if (session) {
    await pspSessionLogout(session.accessToken)
    try {
      if (session.refreshToken) await revoke(session.refreshToken)
      await revoke(session.accessToken)
    } catch {
      /* ignore */
    }
  }

  const res = NextResponse.redirect(new URL(returnTo, ENV.appBaseUrl()))
  clearSessionOn(res)
  return res
}

export const GET = handle
export const POST = handle
