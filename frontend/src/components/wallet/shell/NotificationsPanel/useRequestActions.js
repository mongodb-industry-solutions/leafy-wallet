'use client'

import { useState } from 'react'
import { payRequest, resolveRequest } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

const OFFLINE_PAY_ERROR = 'You need to be online to pay a request.'

/**
 * Pay/decline actions for the payment requests in the notifications feed. Paying moves real money,
 * so it needs the network and a confirmation step; declining only rewrites a record and works offline.
 * @returns {{pending: object|null, busyId: string|null, error: string, notice: string, askToPay: (n: object) => void, cancelPay: () => void, confirmPay: () => Promise<void>, handleDecline: (reference: string) => Promise<void>}}
 */
export function useRequestActions() {
  const { refresh, watchTransfer, isOnline } = useWalletData()
  const [pending, setPending] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function askToPay(notification) {
    setError('')
    setNotice('')
    if (!isOnline) {
      setError(OFFLINE_PAY_ERROR)
      return
    }
    setPending(notification)
  }

  function cancelPay() {
    setPending(null)
    setError('')
  }

  async function confirmPay() {
    const target = pending
    if (!target) return
    setError('')
    setBusyId(target.id)
    const res = await payRequest(target.id)
    setBusyId(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPending(null)
    if (res.warning) setNotice(res.warning)
    await refresh(['accounts', 'transactions', 'requests'])
    watchTransfer(res.reference)
  }

  async function handleDecline(reference) {
    setError('')
    setNotice('')
    setBusyId(reference)
    const res = await resolveRequest(reference, 'declined', isOnline)
    setBusyId(null)
    if (res.ok) refresh(['requests'])
    else setError(res.error)
  }

  return { pending, busyId, error, notice, askToPay, cancelPay, confirmPay, handleDecline }
}
