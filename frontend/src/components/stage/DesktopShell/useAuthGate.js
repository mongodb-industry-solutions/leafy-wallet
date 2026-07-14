'use client'

import { useCallback, useEffect, useState } from 'react'
import { me } from '@/lib/auth/actions'
import { hasCredential } from '@/lib/auth/authenticator'

// Forest-green tint for the identity avatar until we cache a per-user color.
const AVATAR_BG = '00684A'
const LOGOUT_URL = '/api/auth/logout'

/** Shapes the me() identity into the user object the wallet UI expects (Peep seed/bg plus display name). */
function toUser(identity) {
  return {
    name: identity.name || identity.email || 'You',
    email: identity.email || '',
    seed: identity.sub,
    bg: AVATAR_BG,
    sub: identity.sub,
  }
}

/**
 * Resolves the entry phase from the real Leafy Pay session and exposes the transitions the shell needs.
 * On mount it checks me(). With no session it checks for a local passwordless credential to decide
 * between the FaceID path and the SSO login.
 * @returns {{phase: string, user: object|null, handleAuthed: () => void, handleSignOut: () => void, handlePasswordlessFallback: () => void}}
 */
export function useAuthGate() {
  // 'loading' | 'login' | 'faceid' | 'authed'
  const [phase, setPhase] = useState('loading')
  const [user, setUser] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const identity = await me().catch(() => null)
      if (cancelled) return
      if (identity) {
        setUser(toUser(identity))
        setPhase('authed')
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
    } else {
      setPhase('login')
    }
  }, [])

  // Full navigation to single sign-out at Leafy Pay, then back to the app (reloads into the LoginScreen).
  const handleSignOut = useCallback(() => {
    window.location.href = LOGOUT_URL
  }, [])

  // Credential revoked at Leafy Pay, so drop back to SSO.
  const handlePasswordlessFallback = useCallback(() => setPhase('login'), [])

  return { phase, user, handleAuthed, handleSignOut, handlePasswordlessFallback }
}
