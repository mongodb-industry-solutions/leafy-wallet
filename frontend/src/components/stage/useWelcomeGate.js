'use client'

import { useCallback, useState } from 'react'

// Key-naming shape follows WalletDataProvider's `leafy:<domain>:<detail>`. Deliberately sessionStorage,
// not localStorage: a booth kiosk is one browser profile with many first-time visitors, so a permanent
// "seen" flag would mean only the first person of the day ever sees the welcome. The flag is cleared on
// sign-out (useAuthGate) - at a booth, sign-out is the signal that the next visitor has arrived.
export const WELCOME_SEEN_KEY = 'leafy:welcome-seen'
// "Watch the tour" intent has to survive the SSO round-trip (a full-page navigation), so it cannot live
// in React state. DesktopShell consumes it once the session reports `authed` (Phase 2).
export const TOUR_INTENT_KEY = 'leafy:tour-intent'

/** Reads the seen flag, guarded because sessionStorage is unavailable during SSR. */
function hasSeenWelcome() {
  return typeof window !== 'undefined' && window.sessionStorage.getItem(WELCOME_SEEN_KEY) === '1'
}

/**
 * Gates the pre-auth welcome overlay for the booth. Opens once per browser session, until the visitor
 * dismisses it or signs out. Starting the tour is auth-aware (it may need to outlive the SSO redirect),
 * so that lives in DesktopShell; this hook only owns open/seen state.
 * @param {boolean} isEntrySettled - Whether the entry screen has resolved; holds the welcome back so
 *   it never opens underneath the FaceID unlock.
 * @returns {{
 *   isWelcomeOpen: boolean,
 *   showWelcome: () => void,
 *   dismissWelcome: () => void,
 * }}
 */
export function useWelcomeGate(isEntrySettled) {
  // Snapshot at mount, which is equivalent to reading on settle: within one page life only dismiss
  // writes the flag, and that records the override below too. Sign-out clears it via a full reload.
  const [wasSeenAtMount] = useState(hasSeenWelcome)
  // null until the visitor acts; their explicit choice then wins over the automatic open.
  const [isOpenOverride, setIsOpenOverride] = useState(null)

  const isWelcomeOpen = isOpenOverride ?? (isEntrySettled && !wasSeenAtMount)

  // Re-entry point on the stage: reopen without touching the seen flag.
  const showWelcome = useCallback(() => setIsOpenOverride(true), [])

  const dismissWelcome = useCallback(() => {
    window.sessionStorage.setItem(WELCOME_SEEN_KEY, '1')
    setIsOpenOverride(false)
  }, [])

  return { isWelcomeOpen, showWelcome, dismissWelcome }
}
