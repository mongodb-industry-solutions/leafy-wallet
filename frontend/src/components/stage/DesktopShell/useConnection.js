'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Manages the simulated "internet" connection state for the demo.
 *
 * Presenter control:
 *   ⌘K / Ctrl+K → toggle simulated connection (online ↔ offline)
 *   (clicking the on-screen key-cap does the same)
 * Boot flag:
 *   ?offline=1 → open the demo already offline (for a known opening scene)
 *
 * The state is intentionally *not* shown as a pill inside the phone — it's
 * surfaced ambiently by the edge glow around the whole stage.
 */
export function useConnection() {
  const [isOnline, setIsOnline] = useState(true)

  const handleToggle = useCallback(() => setIsOnline((o) => !o), [])

  // Honour ?offline=1 once, on mount. Done in an effect (not a lazy initializer)
  // so the server and first client render agree, avoiding a hydration mismatch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('offline') === '1') setIsOnline(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleToggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleToggle])

  return { isOnline, handleToggle }
}
