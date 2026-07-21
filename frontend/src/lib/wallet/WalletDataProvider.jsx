'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  getAccounts,
  getContacts,
  getRequests,
  getTransactions,
  getTransferStatus,
  markTransferSettled,
  reconcileWithLeafyPay,
  replayPendingRequests,
  replayPendingSends,
} from '@/lib/wallet/actions'

const SETTLE_POLL_MS = 2500
const SETTLE_MAX_POLLS = 8

// Each wallet dataset maps to the Server Action that loads it. The read itself runs on the server
// (session + Bearer never leave it); this provider caches the result on the client and shares it
// across tabs so switching screens never re-hits Leafy Pay. Each loader takes the connection state,
// which picks the source: Leafy Pay + Atlas online, the on-device store offline.
const LOADERS = {
  accounts: getAccounts,
  contacts: getContacts,
  transactions: getTransactions,
  requests: getRequests,
}
const ALL_KEYS = Object.keys(LOADERS)
const INITIAL = { data: null, isLoading: true, error: false }

const seenStorageKey = (ownerKey) => `leafy:notif-seen:${ownerKey || 'anon'}`
const dismissedStorageKey = (ownerKey) => `leafy:notif-dismissed:${ownerKey || 'anon'}`

const isNewerThan = (createdAt, seenAt) =>
  !seenAt || (createdAt ? new Date(createdAt).getTime() > seenAt : false)

/**
 * Derive the notifications feed: received transfers (the PSP has no received-money notification, so
 * we surface the inbound transfers themselves) plus pending payment requests addressed to the user.
 * Unread when newer than the last time the bell was opened. Dismissed ids are hidden - the feed is
 * derived, so dismissal is a per-device presentation choice, not a change to the records.
 */
function deriveNotifications(transactions, requests, lastSeen, dismissedIds) {
  const seenAt = lastSeen ? new Date(lastSeen).getTime() : 0
  const dismissed = new Set(dismissedIds)
  const received = (transactions ?? [])
    .filter((t) => t.amount > 0)
    .map((t) => ({
      kind: 'received',
      id: t.id,
      name: t.name,
      amount: t.amount,
      note: t.note,
      date: t.date,
      createdAt: t.createdAt,
      isPending: t.isPending,
      seed: t.seed,
      bg: t.bg,
      isUnread: isNewerThan(t.createdAt, seenAt),
    }))
  const incoming = (requests?.incoming ?? []).map((r) => ({
    kind: 'request',
    id: r.id,
    name: r.name,
    amount: r.amount,
    note: r.note,
    date: r.date,
    createdAt: r.createdAt,
    isPending: false,
    seed: r.seed,
    bg: r.bg,
    isUnread: isNewerThan(r.createdAt, seenAt),
  }))
  return [...received, ...incoming]
    .filter((n) => !dismissed.has(n.id))
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
}

const WalletDataContext = createContext(null)

/**
 * Client cache for the wallet's read data (accounts, contacts, transactions, requests). Fetches each
 * dataset once per login and shares it across tabs. Revalidation is event-driven, never on tab switch:
 * `refresh(keys)` after a transaction, and an automatic refresh when the connection changes. Also
 * derives the notifications feed (received transfers + incoming requests) with a persisted per-user
 * "seen" marker.
 * @param {object} props
 * @param {boolean} [props.isOnline] - Picks the data source; on reconnect, also replays queued sends.
 * @param {string} [props.ownerKey] - Namespaces the persisted notifications-seen marker (the user's sub).
 * @param {React.ReactNode} props.children
 */
export function WalletDataProvider({ isOnline = true, ownerKey, children }) {
  const [state, setState] = useState({
    accounts: INITIAL,
    contacts: INITIAL,
    transactions: INITIAL,
    requests: INITIAL,
  })
  const [lastSeen, setLastSeen] = useState(null)
  const [dismissedIds, setDismissedIds] = useState([])

  // In a ref so `load`/`refresh` keep a stable identity: a dependency would rebuild every
  // consumer's callbacks on each toggle.
  const isOnlineRef = useRef(isOnline)
  isOnlineRef.current = isOnline

  // `isLoading` drives the skeletons: true only when there's nothing to show yet.
  const load = useCallback(async (key) => {
    setState((s) => ({ ...s, [key]: { ...s[key], isLoading: s[key].data === null, error: false } }))
    try {
      const data = await LOADERS[key](isOnlineRef.current)
      setState((s) => ({ ...s, [key]: { data, isLoading: false, error: false } }))
    } catch {
      setState((s) => ({ ...s, [key]: { data: null, isLoading: false, error: true } }))
    }
  }, [])

  /** Re-pull one or more datasets (defaults to all). Resolves once every requested load settles. */
  const refresh = useCallback((keys = ALL_KEYS) => Promise.all(keys.map(load)), [load])

  /**
   * Watch a just-sent transfer until it settles (`completed`/`failed`) or times out, refreshing after
   * each poll so the balance and Activity flip Pending → Completed on their own - independent of the
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
        const isSettled = status === 'completed' || status === 'failed'
        // Before the refresh, so it reads back the settled status.
        if (isSettled) await markTransferSettled(reference, status)
        await refresh(['accounts', 'transactions'])
        polls += 1
        if (isSettled || polls >= SETTLE_MAX_POLLS) return
        setTimeout(tick, SETTLE_POLL_MS)
      }
      setTimeout(tick, SETTLE_POLL_MS)
    },
    [refresh],
  )

  // Initial load, once per mount (i.e. once per login). When online, also converge the
  // enrichment stores to Leafy Pay and re-read whatever the reconcile pruned.
  const hasLoaded = useRef(false)
  useEffect(() => {
    if (hasLoaded.current) return
    hasLoaded.current = true
    refresh()
    if (!isOnlineRef.current) return
    reconcileWithLeafyPay().then((result) => {
      const changed =
        (result?.prunedTransactions ?? 0) +
        (result?.prunedContacts ?? 0) +
        (result?.prunedRequests ?? 0) +
        (result?.adoptedTransactions ?? 0)
      if (changed > 0) refresh(['contacts', 'transactions', 'requests'])
    })
  }, [refresh])

  // Both directions re-read, since the source changes. Reconnecting also replays whatever was
  // composed offline: Sync moves records, but only Leafy Pay reaches the other wallet.
  const wasOnline = useRef(isOnline)
  useEffect(() => {
    if (isOnline === wasOnline.current) return
    const isReconnect = isOnline && !wasOnline.current
    wasOnline.current = isOnline

    async function resync() {
      if (isReconnect) {
        const [sends] = await Promise.all([
          replayPendingSends().catch(() => null),
          replayPendingRequests().catch(() => null),
        ])
        sends?.references?.forEach(watchTransfer)
      }
      refresh()
    }
    resync()
  }, [isOnline, refresh, watchTransfer])

  // Load the persisted "notifications seen" marker and dismissals for this user.
  useEffect(() => {
    if (typeof window === 'undefined') return
    setLastSeen(window.localStorage.getItem(seenStorageKey(ownerKey)))
    try {
      setDismissedIds(JSON.parse(window.localStorage.getItem(dismissedStorageKey(ownerKey)) ?? '[]'))
    } catch {
      setDismissedIds([])
    }
  }, [ownerKey])

  /** Mark all notifications read; persists so the badge stays cleared across reloads. */
  const markNotificationsSeen = useCallback(() => {
    const now = new Date().toISOString()
    setLastSeen(now)
    if (typeof window !== 'undefined') window.localStorage.setItem(seenStorageKey(ownerKey), now)
  }, [ownerKey])

  /** Hide notifications on this device; persists so they stay hidden across reloads. */
  const dismissNotifications = useCallback(
    (ids) => {
      const next = [...new Set([...dismissedIds, ...ids])]
      setDismissedIds(next)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(dismissedStorageKey(ownerKey), JSON.stringify(next))
      }
    },
    [dismissedIds, ownerKey],
  )

  const notifications = deriveNotifications(
    state.transactions.data,
    state.requests.data,
    lastSeen,
    dismissedIds,
  )
  const unreadCount = notifications.reduce((n, x) => n + (x.isUnread ? 1 : 0), 0)

  const value = {
    ...state,
    isOnline,
    refresh,
    watchTransfer,
    notifications,
    unreadCount,
    markNotificationsSeen,
    dismissNotifications,
  }
  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>
}

/** Access the shared wallet data cache. Must be used within a WalletDataProvider. */
export function useWalletData() {
  const ctx = useContext(WalletDataContext)
  if (!ctx) throw new Error('useWalletData must be used within a WalletDataProvider')
  return ctx
}
