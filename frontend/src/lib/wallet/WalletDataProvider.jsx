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
import { byNewestFirst } from '@/lib/wallet/format'

const SETTLE_POLL_MS = 2500
const SETTLE_MAX_POLLS = 8
// Leafy Pay pushes nothing, so anything arriving from someone else has to be looked for.
const ARRIVAL_POLL_MS = 15000

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

/** The persisted "notifications seen" marker for a user, or null when nothing has been read yet. */
function readSeenMarker(ownerKey) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(seenStorageKey(ownerKey))
}

/** The notification ids dismissed on this device for a user. */
function readDismissedIds(ownerKey) {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(dismissedStorageKey(ownerKey)) ?? '[]')
  } catch {
    return []
  }
}

const isNewerThan = (createdAt, seenAt) =>
  !seenAt || (createdAt ? new Date(createdAt).getTime() > seenAt : false)

/** Received transfers in a getTransactions() result: money in, not out. */
const receivedRows = (data) => (data ?? []).filter((t) => t.amount > 0)

/**
 * Banner the first row that turned up since the last load. The first load only records the baseline,
 * so what was already waiting at login is not announced as new. The seen set only ever grows: the
 * offline store can hold fewer rows than Leafy Pay, and a row reappearing is not an arrival.
 */
function announceNew(rows, seenRef, kind, setArrival) {
  const known = seenRef.current
  const ids = new Set(rows.map((r) => r.id))
  seenRef.current = known ? new Set([...known, ...ids]) : ids
  const arrived = known && rows.find((r) => !known.has(r.id))
  if (arrived) setArrival({ kind, ...arrived })
}

/**
 * Derive the notifications feed: received transfers (the PSP has no received-money notification, so
 * we surface the inbound transfers themselves) plus pending payment requests addressed to the user.
 * Unread when newer than the last time the bell was opened. Dismissed ids are hidden - the feed is
 * derived, so dismissal is a per-device presentation choice, not a change to the records.
 */
function deriveNotifications(transactions, requests, lastSeen, dismissedIds) {
  const seenAt = lastSeen ? new Date(lastSeen).getTime() : 0
  const dismissed = new Set(dismissedIds)
  const received = receivedRows(transactions).map((t) => ({
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
  return [...received, ...incoming].filter((n) => !dismissed.has(n.id)).sort(byNewestFirst)
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
  const [state, setState] = useState(() => Object.fromEntries(ALL_KEYS.map((k) => [k, INITIAL])))
  // Seeded from localStorage on mount: the provider mounts once per login, so ownerKey is stable under it.
  const [lastSeen, setLastSeen] = useState(() => readSeenMarker(ownerKey))
  const [dismissedIds, setDismissedIds] = useState(() => readDismissedIds(ownerKey))
  // Carries only the reference and outcome; the banner reads the row itself, so it never renders a
  // stale amount from before the refresh that settled it.
  const [settlement, setSettlement] = useState(null)
  const [arrival, setArrival] = useState(null)
  // What has already been announced, so each row banners once. Null until the first load.
  const announcedRequestsRef = useRef(null)
  const announcedReceivedRef = useRef(null)

  // In a ref so `load`/`refresh` keep a stable identity: a dependency would rebuild every
  // consumer's callbacks on each toggle.
  const isOnlineRef = useRef(isOnline)
  // Declared first so it lands before the effects below, which refresh through `load`.
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  // `isLoading` drives the skeletons: true only when there's nothing to show yet.
  const load = useCallback(async (key) => {
    setState((s) => ({ ...s, [key]: { ...s[key], isLoading: s[key].data === null, error: false } }))
    try {
      const data = await LOADERS[key](isOnlineRef.current)
      if (key === 'requests') {
        announceNew(data?.incoming ?? [], announcedRequestsRef, 'request', setArrival)
      } else if (key === 'transactions') {
        announceNew(receivedRows(data), announcedReceivedRef, 'received', setArrival)
      }
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
   * @param {string} reference - The Leafy Pay transfer reference.
   * @param {'send'|'request-payment'} [origin] - Which screen initiated it. Carried on the settlement so
   *   listeners can tell a send the user composed from a request someone else asked them to pay.
   */
  const watchTransfer = useCallback(
    (reference, origin = 'send') => {
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
        // Announce it: settling can outlast the screen the payment was made from.
        if (isSettled) setSettlement({ reference, status, origin })
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
        // Wrapped, so forEach's index never lands in watchTransfer's `origin`.
        sends?.references?.forEach((reference) => watchTransfer(reference))
      }
      refresh()
    }
    resync()
  }, [isOnline, refresh, watchTransfer])

  // Poll for what someone else can send: requests addressed to the user and inbound transfers.
  // Offline there is nothing new to find, since the local store only changes through this device.
  useEffect(() => {
    if (!isOnline) return undefined
    const id = setInterval(() => refresh(['requests', 'transactions']), ARRIVAL_POLL_MS)
    return () => clearInterval(id)
  }, [isOnline, refresh])

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

  /** Clear the settlement banner once it has played out. */
  const dismissSettlement = useCallback(() => setSettlement(null), [])

  /** Clear the arrival banner once it has played out. */
  const dismissArrival = useCallback(() => setArrival(null), [])

  const value = {
    ...state,
    isOnline,
    refresh,
    watchTransfer,
    notifications,
    unreadCount,
    markNotificationsSeen,
    dismissNotifications,
    settlement,
    dismissSettlement,
    arrival,
    dismissArrival,
  }
  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>
}

/** Access the shared wallet data cache. Must be used within a WalletDataProvider. */
export function useWalletData() {
  const ctx = useContext(WalletDataContext)
  if (!ctx) throw new Error('useWalletData must be used within a WalletDataProvider')
  return ctx
}
