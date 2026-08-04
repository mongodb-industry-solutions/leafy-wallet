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

  const handleToggle = useCallback(() => {
    const nextIsOnline = !isOnline
    setOverride(nextIsOnline)
    // Best-effort: the demo's offline story stands on its own via local reads/writes even if this
    // fails (e.g. leafy-local-store is down), so a network hiccup here shouldn't block the toggle.
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: nextIsOnline ? 'resume' : 'pause' }),
    }).catch(() => {})
  }, [isOnline])

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
