'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lw_offline'

// leafy-local-store's /sync/pause severs the one sync client the whole container shares, so a browser
// flipping it drags every other session offline - and the next session going online restarts it under
// them. Offline writes don't need it (LocalPendingSend is not SYNC_ENABLED), so it's opt-in for solo demos.
const REAL_SYNC_TOGGLE = process.env.NEXT_PUBLIC_REAL_SYNC_TOGGLE === '1'

const listeners = new Set()
const notify = () => listeners.forEach((listener) => listener())

/** Same-tab writes notify directly; `storage` covers a second tab, which shares the key. */
function subscribe(listener) {
  if (listeners.size === 0) window.addEventListener('storage', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', notify)
  }
}

// The presenter's stored choice wins over the URL; ?offline=1 only seeds the first render.
const getOffline = () => {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored !== null) return stored === '1'
  return new URLSearchParams(window.location.search).get('offline') === '1'
}
const getServerOffline = () => false

/**
 * Manages the simulated "internet" connection state for the demo (⌘K/Ctrl+K
 * toggles it, ?offline=1 boots offline), surfaced ambiently by the edge glow.
 *
 * Per-browser by construction: the flag lives in this browser's localStorage - which also survives a
 * reload mid-demo - and toggling it touches no shared server state unless REAL_SYNC_TOGGLE is set.
 */
export function useConnection() {
  const isOnline = !useSyncExternalStore(subscribe, getOffline, getServerOffline)

  const handleToggle = useCallback(() => {
    const nextIsOnline = !isOnline
    window.localStorage.setItem(STORAGE_KEY, nextIsOnline ? '0' : '1')
    notify()
    if (!REAL_SYNC_TOGGLE) return
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
