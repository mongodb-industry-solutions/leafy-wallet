// GET /api/auth/logout. Single sign-out that bumps the Leafy Pay session epoch (invalidating the
// user's outstanding session tokens), revokes our tokens, clears our session cookie, and
// front-channels through Leafy Pay's logout page so its portal cookie (demo_token) is cleared too.
import { NextResponse } from 'next/server'
import { getSession, clearSessionOn } from '@/lib/auth/session'
import { revoke } from '@/lib/auth/oauth'
import { ENV } from '@/lib/auth/env'

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

async function handle() {
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

  // Front-channel: bounce through Leafy Pay's logout page to clear its portal cookie same-origin,
  // then it redirects back to the app.
  const back = new URL('/', ENV.appBaseUrl()).toString()
  const pspLogout = `${ENV.pspBaseUrl()}/auth/logout?redirect=${encodeURIComponent(back)}`
  const res = NextResponse.redirect(pspLogout)
  clearSessionOn(res)
  return res
}

export const GET = handle
export const POST = handle
