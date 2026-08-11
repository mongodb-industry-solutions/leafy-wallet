'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { me } from '@/lib/auth/actions'
import { hasCredential } from '@/lib/auth/authenticator'
import { demoAvatarFor } from '@/lib/demo-users'
import { WELCOME_SEEN_KEY } from '@/components/stage/useWelcomeGate'

// Forest-green tint for the identity avatar when the user isn't a pinned demo profile.
const AVATAR_BG = '00684A'
const LOGOUT_URL = '/api/auth/logout'

/** Shapes the me() identity into the user object the wallet UI expects (Peep seed/bg plus display name). */
function toUser(identity) {
  // Pin the avatar for known demo users so it matches the login card; otherwise derive from the sub.
  const avatar = demoAvatarFor(identity.email) ?? { seed: identity.sub, bg: AVATAR_BG }
  return {
    name: identity.name || identity.email || 'You',
    email: identity.email || '',
    seed: avatar.seed,
    bg: avatar.bg,
    sub: identity.sub,
  }
}

/**
 * Resolves the entry phase from the real Leafy Pay session and exposes the shell's transitions. With no
 * session it checks for a local passwordless credential to choose the FaceID path over the SSO login.
 * @param {() => void} [onAuthenticated] - Fired once each time a session is established, by either
 *   entry path. Lets the caller treat "the session resolved" as the event it is, rather than watching
 *   `phase` from an effect.
 * @returns {{phase: string, user: object|null, handleAuthed: () => void, handleSignOut: () => void, handlePasswordlessFallback: () => void}}
 */
export function useAuthGate(onAuthenticated) {
  // 'loading' | 'login' | 'faceid' | 'authed'
  const [phase, setPhase] = useState('loading')
  const [user, setUser] = useState(null)

  // Held in a ref so a caller's inline callback never restarts the boot below.
  const onAuthenticatedRef = useRef(onAuthenticated)
  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated
  })

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const identity = await me().catch(() => null)
      if (cancelled) return
      if (identity) {
        setUser(toUser(identity))
        setPhase('authed')
        onAuthenticatedRef.current?.()
        return
      }
      const enrolled = await hasCredential().catch(() => false)
      if (cancelled) return
      setPhase(enrolled ? 'faceid' : 'login')
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  // Called after the FaceID/CIBA path establishes a session.
  const handleAuthed = useCallback(async () => {
    const identity = await me().catch(() => null)
    if (identity) {
      setUser(toUser(identity))
      setPhase('authed')
      onAuthenticatedRef.current?.()
    } else {
      setPhase('login')
    }
  }, [])

  // Full navigation to single sign-out at Leafy Pay, then back to the app (reloads into the LoginScreen).
  // At a booth, sign-out means the next visitor is arriving, so re-arm the welcome for them.
  const handleSignOut = useCallback(() => {
    window.sessionStorage.removeItem(WELCOME_SEEN_KEY)
    window.location.href = `${LOGOUT_URL}?return=${encodeURIComponent(window.location.pathname)}`
  }, [])

  // Credential revoked at Leafy Pay, so drop back to SSO.
  const handlePasswordlessFallback = useCallback(() => setPhase('login'), [])

  return { phase, user, handleAuthed, handleSignOut, handlePasswordlessFallback }
}
