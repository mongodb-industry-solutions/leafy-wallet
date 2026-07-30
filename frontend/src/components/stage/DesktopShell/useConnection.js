'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Manages the simulated "internet" connection state for the demo (⌘K/Ctrl+K
 * toggles it, ?offline=1 boots offline), surfaced ambiently by the edge glow.
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
