'use client'

import { useCallback, useEffect, useState } from 'react'

// Key-naming shape follows WalletDataProvider's `leafy:<domain>:<detail>`. Deliberately sessionStorage,
// not localStorage: a booth kiosk is one browser profile with many first-time visitors, so a permanent
// "seen" flag would mean only the first person of the day ever sees the welcome. The flag is cleared on
// sign-out (useAuthGate) - at a booth, sign-out is the signal that the next visitor has arrived.
export const WELCOME_SEEN_KEY = 'leafy:welcome-seen'
// "Watch the tour" intent has to survive the SSO round-trip (a full-page navigation), so it cannot live
// in React state. DesktopShell consumes it once the session reports `authed` (Phase 2).
export const TOUR_INTENT_KEY = 'leafy:tour-intent'

/**
 * Gates the pre-auth welcome overlay for the booth. Opens once per browser session (until the visitor
 * dismisses it or signs out), and records a "start the tour" intent that outlives the SSO redirect.
 * @returns {{
 *   isWelcomeOpen: boolean,
 *   showWelcome: () => void,
 *   dismissWelcome: () => void,
 *   startTour: () => void,
 * }}
 */
export function useWelcomeGate() {
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)

  // Open on mount unless already seen this session. Done in an effect (not a lazy initializer) so the
  // server and first client render agree - sessionStorage is unavailable during SSR.
  useEffect(() => {
    if (window.sessionStorage.getItem(WELCOME_SEEN_KEY) !== '1') setIsWelcomeOpen(true)
  }, [])

  const markSeen = useCallback(() => {
    window.sessionStorage.setItem(WELCOME_SEEN_KEY, '1')
  }, [])

  // Re-entry point on the stage: reopen without touching the seen flag.
  const showWelcome = useCallback(() => setIsWelcomeOpen(true), [])

  const dismissWelcome = useCallback(() => {
    markSeen()
    setIsWelcomeOpen(false)
  }, [markSeen])

  // Primary action: record the intent so it survives the SSO round-trip, then close and let the visitor
  // sign in. The tour itself begins post-auth in Phase 2, which consumes TOUR_INTENT_KEY.
  const startTour = useCallback(() => {
    window.sessionStorage.setItem(TOUR_INTENT_KEY, '1')
    markSeen()
    setIsWelcomeOpen(false)
  }, [markSeen])

  return { isWelcomeOpen, showWelcome, dismissWelcome, startTour }
}
