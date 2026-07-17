'use client'

import { useState } from 'react'
import { resolveRequest } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

const OFFLINE_PAY_ERROR = 'You need to be online to pay a request.'

/**
 * Actions for the payment requests in the notifications feed. Paying moves real money, so it needs
 * the network - `tryPay` gates on that and the panel hands off to the full review flow. Declining
 * only rewrites a record and works offline.
 * @returns {{busyId: string|null, error: string, tryPay: () => boolean, handleDecline: (reference: string) => Promise<void>}}
 */
export function useRequestActions() {
  const { refresh, isOnline } = useWalletData()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  /** Whether paying is possible right now; surfaces the offline error when not. */
  function tryPay() {
    setError('')
    if (!isOnline) {
      setError(OFFLINE_PAY_ERROR)
      return false
    }
    return true
  }

  async function handleDecline(reference) {
    setError('')
    setBusyId(reference)
    const res = await resolveRequest(reference, 'declined', isOnline)
    setBusyId(null)
    if (res.ok) refresh(['requests'])
    else setError(res.error)
  }

  return { busyId, error, tryPay, handleDecline }
}
