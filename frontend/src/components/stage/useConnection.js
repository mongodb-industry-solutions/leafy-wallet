'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// Nothing to subscribe to: the boot value is read once from the URL. useSyncExternalStore is still
// right, since it reads a browser-only value during render without a hydration mismatch.
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

  const handleToggle = useCallback(async () => {
    const nextIsOnline = !isOnline
    setOverride(nextIsOnline)

    // Revert if this fails, otherwise sync keeps running while the UI claims to be offline.
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextIsOnline ? 'resume' : 'pause' }),
      })
      if (!res.ok) throw new Error(`sync toggle failed: ${res.status}`)
    } catch {
      setOverride(isOnline)
    }
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
