'use client'

import { useState } from 'react'
import { payRequest, resolveRequest } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

const OFFLINE_PAY_ERROR = 'You need to be online to pay a request.'

/**
 * Pay/decline actions for the payment requests in the notifications feed. Paying runs a real
 * transfer, so it needs the network and hands the reference to the settlement watcher; declining
 * works offline.
 * @returns {{busyId: string|null, error: string, handlePay: (reference: string) => Promise<void>, handleDecline: (reference: string) => Promise<void>}}
 */
export function useRequestActions() {
  const { refresh, watchTransfer, isOnline } = useWalletData()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function handlePay(reference) {
    setError('')
    if (!isOnline) {
      setError(OFFLINE_PAY_ERROR)
      return
    }
    setBusyId(reference)
    const res = await payRequest(reference)
    setBusyId(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    await refresh(['accounts', 'transactions', 'requests'])
    watchTransfer(res.reference)
  }

  async function handleDecline(reference) {
    setError('')
    setBusyId(reference)
    const res = await resolveRequest(reference, 'declined', isOnline)
    setBusyId(null)
    if (res.ok) refresh(['requests'])
    else setError(res.error)
  }

  return { busyId, error, handlePay, handleDecline }
}
