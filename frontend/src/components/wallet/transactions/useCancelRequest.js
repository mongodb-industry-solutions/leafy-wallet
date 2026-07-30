'use client'

import { useState } from 'react'
import { resolveRequest } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

const OFFLINE_ERROR = 'You need to be online to cancel a request.'

/**
 * Withdraw a request the user raised. Leafy Pay owns the record and has no path back out of
 * `cancelled`, so this needs a connection and a confirmation before it fires.
 * @param {() => void} onDone - Called once the request is cancelled (closes the sheet).
 * @returns {{isConfirming: boolean, isBusy: boolean, error: string, ask: () => void, dismiss: () => void, confirm: (reference: string) => Promise<void>}}
 */
export function useCancelRequest(onDone) {
  const { refresh, isOnline } = useWalletData()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  function ask() {
    setError(isOnline ? '' : OFFLINE_ERROR)
    setIsConfirming(true)
  }

  function dismiss() {
    setIsConfirming(false)
    setError('')
  }

  async function confirm(reference) {
    if (!isOnline) {
      setError(OFFLINE_ERROR)
      return
    }
    setError('')
    setIsBusy(true)
    const res = await resolveRequest(reference, 'cancelled')
    setIsBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setIsConfirming(false)
    refresh(['requests'])
    onDone()
  }

  return { isConfirming, isBusy, error, ask, dismiss, confirm }
}
