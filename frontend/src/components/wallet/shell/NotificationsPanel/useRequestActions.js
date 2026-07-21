'use client'

import { useState } from 'react'
import { resolveRequest } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

const OFFLINE_ERROR = 'You need to be online to answer a request.'

/**
 * Actions for the requests in the notifications feed. Both need the network: Leafy Pay owns the
 * request, so paying moves money there and declining is a transition only it can make.
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
      setError(OFFLINE_ERROR)
      return false
    }
    return true
  }

  async function handleDecline(reference) {
    setError('')
    if (!isOnline) {
      setError(OFFLINE_ERROR)
      return
    }
    setBusyId(reference)
    const res = await resolveRequest(reference, 'declined')
    setBusyId(null)
    if (res.ok) refresh(['requests'])
    else setError(res.error)
  }

  return { busyId, error, tryPay, handleDecline }
}
