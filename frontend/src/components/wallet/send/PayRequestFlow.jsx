'use client'

import { useState } from 'react'
import { payRequest } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { formatMoney } from '@/lib/wallet/format'
import { ConfirmStep } from '@/components/wallet/send/ConfirmStep'
import { SuccessStep } from '@/components/wallet/send/SuccessStep'

const EUR_SYMBOL = '€'
const EMPTY_NOTE = 'No note'

/**
 * Paying a payment request, through the same review screen as a normal send: amount and recipient
 * are fixed by the request, the note and source account stay editable. Confirms via `payRequest`,
 * which also marks the request paid.
 * @param {object} props
 * @param {object} props.notification - The request notification (`kind: 'request'`).
 * @param {boolean} [props.isOnline]
 * @param {() => void} props.onClose
 */
export function PayRequestFlow({ notification, isOnline = true, onClose }) {
  const { accounts: accountsState, refresh, watchTransfer, dismissNotifications } = useWalletData()
  const accounts = accountsState.data ?? []
  const primaryAccount = accounts.find((a) => a.isDefault) ?? accounts[0]

  const [note, setNote] = useState(notification.note === EMPTY_NOTE ? '' : notification.note)
  const [fromRef, setFromRef] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('confirm')
  const [sentReference, setSentReference] = useState(null)

  const fromAccount = accounts.find((a) => a.reference === fromRef) ?? primaryAccount
  const balanceValue = fromAccount?.balanceValue ?? 0
  const amount = Math.abs(notification.amount)
  const display = amount.toFixed(2)
  const insufficient = amount > balanceValue
  const recipient = {
    name: notification.name,
    seed: notification.seed,
    bg: notification.bg,
    lookupHint: `Requested ${notification.date}`,
  }
  const shared = { display, isRequest: false, recipient, symbol: EUR_SYMBOL }

  async function handleSubmit() {
    setError('')
    setIsSubmitting(true)
    const res = await payRequest(notification.id, fromAccount?.reference, note)
    setIsSubmitting(false)
    if (!res.ok) {
      setError(res.error || 'Could not pay this request. Please try again.')
      return
    }
    setSentReference(res.reference)
    // Also hide the notification: if marking the request paid failed server-side, the pending
    // request would otherwise resurface in the feed and invite paying it twice.
    dismissNotifications([notification.id])
    refresh(['accounts', 'transactions', 'requests'])
    watchTransfer(res.reference, 'request-payment')
    setStep('success')
  }

  if (step === 'confirm') {
    return (
      <ConfirmStep
        {...shared}
        note={note}
        setNote={setNote}
        fromAccount={fromAccount}
        accounts={accounts}
        canPickAccount={accounts.length > 1}
        onPickAccount={(a) => setFromRef(a.reference)}
        insufficient={insufficient}
        remaining={formatMoney(balanceValue - amount)}
        isSubmitting={isSubmitting}
        error={error}
        onBack={onClose}
        onSubmit={handleSubmit}
      />
    )
  }

  return <SuccessStep {...shared} reference={sentReference} isOnline={isOnline} onClose={onClose} />
}
