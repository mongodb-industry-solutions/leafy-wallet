'use client'

import { useState } from 'react'
import { sendMoney } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { formatMoney } from '@/lib/wallet/format'
import { NumpadStep } from '@/components/wallet/send/NumpadStep/NumpadStep'
import { RecipientStep } from '@/components/wallet/send/RecipientStep/RecipientStep'
import { ConfirmStep } from '@/components/wallet/send/ConfirmStep/ConfirmStep'
import { SuccessStep } from '@/components/wallet/send/SuccessStep/SuccessStep'

const EUR_SYMBOL = '€'

/**
 * The multi-step send/request flow: amount entry, recipient picker, confirmation, and success. Send
 * executes a real Leafy Pay transfer (with the note written to Atlas); request and offline sends are
 * handled optimistically here (offline queueing is a later phase).
 * @param {object} props
 * @param {object} [props.initialContact] - Pre-fills the recipient (skips the recipient step).
 * @param {'send'|'request'} [props.initialMode]
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 * @param {() => void} props.onClose
 */
export function SendFlow({ initialContact, initialMode = 'send', isOnline = true, onClose }) {
  const { accounts: accountsState, refresh } = useWalletData()
  const accounts = accountsState.data ?? []
  const primaryAccount = accounts.find((a) => a.isDefault) ?? accounts[0]
  const balanceValue = primaryAccount?.balanceValue ?? 0

  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState('numpad')
  const [cents, setCents] = useState(0)
  const [recipient, setRecipient] = useState(initialContact || null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const display = cents === 0 ? '0' : (cents / 100).toFixed(2)
  const euros = cents / 100
  const isRequest = mode === 'request'
  const currency = { symbol: EUR_SYMBOL, balance: formatMoney(balanceValue) }
  const shared = { display, isRequest, recipient, symbol: EUR_SYMBOL }

  function handlePickMode(nextMode) {
    setMode(nextMode)
    if (cents > 0) setStep(recipient ? 'confirm' : 'recipient')
  }

  async function handleSubmit() {
    setError('')
    // Requests and offline sends don't hit Leafy Pay here; offline queueing is a later phase.
    if (isRequest || !isOnline) {
      setStep('success')
      return
    }
    setIsSubmitting(true)
    const res = await sendMoney({
      counterpartyArrangementReference: recipient.reference,
      amount: euros,
      note,
    })
    setIsSubmitting(false)
    if (res.ok) {
      // The transfer moved money and added a transaction — revalidate both so Home/Activity are fresh.
      refresh(['accounts', 'transactions'])
      setStep('success')
    } else {
      setError(res.error || 'Could not send. Please try again.')
    }
  }

  if (step === 'numpad') {
    return (
      <NumpadStep
        display={display}
        cents={cents}
        currency={currency}
        recipient={recipient}
        setCents={setCents}
        onClose={onClose}
        onPick={handlePickMode}
      />
    )
  }

  if (step === 'recipient') {
    return (
      <RecipientStep
        {...shared}
        note={note}
        setNote={setNote}
        setRecipient={setRecipient}
        onBack={() => setStep('numpad')}
        onNext={() => recipient && setStep('confirm')}
      />
    )
  }

  if (step === 'confirm' && recipient) {
    return (
      <ConfirmStep
        {...shared}
        note={note}
        remaining={formatMoney(balanceValue - euros)}
        isSubmitting={isSubmitting}
        error={error}
        onBack={() => setStep(initialContact ? 'numpad' : 'recipient')}
        onSubmit={handleSubmit}
      />
    )
  }

  return <SuccessStep {...shared} isOnline={isOnline} onClose={onClose} />
}
