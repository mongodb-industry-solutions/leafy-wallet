'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getAccounts, getContacts, getTransactions } from '@/lib/wallet/actions'

// Each wallet dataset maps to the Server Action that loads it. The read itself runs on the server
// (session + Bearer never leave it); this provider caches the result on the client and shares it
// across tabs so switching screens never re-hits Leafy Pay.
const LOADERS = { accounts: getAccounts, contacts: getContacts, transactions: getTransactions }
const ALL_KEYS = Object.keys(LOADERS)
const INITIAL = { data: null, isLoading: true, error: false }

const WalletDataContext = createContext(null)

/**
 * Client cache for the wallet's read data (accounts, contacts, transactions). Fetches each dataset
 * once per login and shares it across tabs. Revalidation is event-driven, never on tab switch:
 * `refresh(keys)` after a transaction, and an automatic refresh when the connection is restored.
 * @param {object} props
 * @param {boolean} [props.isOnline] - When it flips false→true (reconnect), the data is refreshed.
 * @param {React.ReactNode} props.children
 */
export function WalletDataProvider({ isOnline = true, children }) {
  const [state, setState] = useState({ accounts: INITIAL, contacts: INITIAL, transactions: INITIAL })

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

  return <WalletDataContext.Provider value={{ ...state, refresh }}>{children}</WalletDataContext.Provider>
}

/** Access the shared wallet data cache. Must be used within a WalletDataProvider. */
export function useWalletData() {
  const ctx = useContext(WalletDataContext)
  if (!ctx) throw new Error('useWalletData must be used within a WalletDataProvider')
  return ctx
}
