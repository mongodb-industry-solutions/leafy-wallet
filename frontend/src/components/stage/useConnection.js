'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// The boot value is read once from the URL and never changes afterwards, so there is nothing to
// subscribe to. useSyncExternalStore is still the right tool: it is how React reads a browser-only
// value during render without a hydration mismatch, since the server gets its own snapshot.
const subscribeToNothing = () => () => {}
const getBootOffline = () => new URLSearchParams(window.location.search).get('offline') === '1'
const getServerBootOffline = () => false

/**
 * Manages the simulated "internet" connection state for the demo (⌘K/Ctrl+K
 * toggles it, ?offline=1 boots offline), surfaced ambiently by the edge glow.
 */
export function useConnection() {
  const isBootOffline = useSyncExternalStore(subscribeToNothing, getBootOffline, getServerBootOffline)
  // null until the presenter toggles; their choice then wins over whatever the URL asked for.
  const [override, setOverride] = useState(null)
  const isOnline = override ?? !isBootOffline

  const handleToggle = useCallback(() => setOverride(!isOnline), [isOnline])

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
