'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getAccounts, getContacts, getTransactions, getTransferStatus } from '@/lib/wallet/actions'

const SETTLE_POLL_MS = 2500
const SETTLE_MAX_POLLS = 8

// Each wallet dataset maps to the Server Action that loads it. The read itself runs on the server
// (session + Bearer never leave it); this provider caches the result on the client and shares it
// across tabs so switching screens never re-hits Leafy Pay.
const LOADERS = { accounts: getAccounts, contacts: getContacts, transactions: getTransactions }
const ALL_KEYS = Object.keys(LOADERS)
const INITIAL = { data: null, isLoading: true, error: false }

const seenStorageKey = (ownerKey) => `leafy:notif-seen:${ownerKey || 'anon'}`

/**
 * Derive the notifications feed from the transaction list: each received transfer is a notification,
 * "unread" when it's newer than the last time the bell was opened (the PSP has no received-money
 * notification, so we surface the inbound transfers themselves).
 */
function deriveNotifications(transactions, lastSeen) {
  const seenAt = lastSeen ? new Date(lastSeen).getTime() : 0
  return (transactions ?? [])
    .filter((t) => t.amount > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      note: t.note,
      date: t.date,
      createdAt: t.createdAt,
      isPending: t.isPending,
      seed: t.seed,
      bg: t.bg,
      isUnread: !seenAt || (t.createdAt ? new Date(t.createdAt).getTime() > seenAt : false),
    }))
}

const WalletDataContext = createContext(null)

/**
 * Client cache for the wallet's read data (accounts, contacts, transactions). Fetches each dataset
 * once per login and shares it across tabs. Revalidation is event-driven, never on tab switch:
 * `refresh(keys)` after a transaction, and an automatic refresh when the connection is restored. Also
 * derives the notifications feed (received transfers) with a persisted per-user "seen" marker.
 * @param {object} props
 * @param {boolean} [props.isOnline] - When it flips false→true (reconnect), the data is refreshed.
 * @param {string} [props.ownerKey] - Namespaces the persisted notifications-seen marker (the user's sub).
 * @param {React.ReactNode} props.children
 */
export function WalletDataProvider({ isOnline = true, ownerKey, children }) {
  const [state, setState] = useState({ accounts: INITIAL, contacts: INITIAL, transactions: INITIAL })
  const [lastSeen, setLastSeen] = useState(null)

  const load = useCallback(async (key) => {
    setState((s) => ({ ...s, [key]: { ...s[key], isLoading: true, error: false } }))
    try {
      const data = await LOADERS[key]()
      setState((s) => ({ ...s, [key]: { data, isLoading: false, error: false } }))
    } catch {
      setState((s) => ({ ...s, [key]: { data: null, isLoading: false, error: true } }))
    }
  }, [])

  /** Re-pull one or more datasets (defaults to all). Resolves once every requested load settles. */
  const refresh = useCallback((keys = ALL_KEYS) => Promise.all(keys.map(load)), [load])

  /**
   * Watch a just-sent transfer until it settles (`completed`/`failed`) or times out, refreshing after
   * each poll so the balance and Activity flip Pending → Completed on their own — independent of the
   * success screen staying open.
   */
  const watchTransfer = useCallback(
    (reference) => {
      if (!reference) return
      let polls = 0
      async function tick() {
        let status = 'pending'
        try {
          const res = await getTransferStatus(reference)
          status = res.status
        } catch {
          /* transient; keep polling */
        }
        await refresh(['accounts', 'transactions'])
        polls += 1
        if (status === 'completed' || status === 'failed' || polls >= SETTLE_MAX_POLLS) return
        setTimeout(tick, SETTLE_POLL_MS)
      }
      setTimeout(tick, SETTLE_POLL_MS)
    },
    [refresh],
  )

  // Initial load, once per mount (i.e. once per login).
  const hasLoaded = useRef(false)
  useEffect(() => {
    if (hasLoaded.current) return
    hasLoaded.current = true
    refresh()
  }, [refresh])

  // On reconnect, the balance/history may have moved while offline — pull fresh data.
  const wasOnline = useRef(isOnline)
  useEffect(() => {
    if (isOnline && !wasOnline.current) refresh()
    wasOnline.current = isOnline
  }, [isOnline, refresh])

  // Load the persisted "notifications seen" marker for this user.
  useEffect(() => {
    if (typeof window === 'undefined') return
    setLastSeen(window.localStorage.getItem(seenStorageKey(ownerKey)))
  }, [ownerKey])

  /** Mark all notifications read; persists so the badge stays cleared across reloads. */
  const markNotificationsSeen = useCallback(() => {
    const now = new Date().toISOString()
    setLastSeen(now)
    if (typeof window !== 'undefined') window.localStorage.setItem(seenStorageKey(ownerKey), now)
  }, [ownerKey])

  const notifications = deriveNotifications(state.transactions.data, lastSeen)
  const unreadCount = notifications.reduce((n, x) => n + (x.isUnread ? 1 : 0), 0)

  const value = { ...state, refresh, watchTransfer, notifications, unreadCount, markNotificationsSeen }
  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>
}

/** Access the shared wallet data cache. Must be used within a WalletDataProvider. */
export function useWalletData() {
  const ctx = useContext(WalletDataContext)
  if (!ctx) throw new Error('useWalletData must be used within a WalletDataProvider')
  return ctx
}
