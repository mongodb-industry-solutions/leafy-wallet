'use client'

import { useState } from 'react'
import { createRequest, sendMoney } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { formatMoney } from '@/lib/wallet/format'
import { NumpadStep } from '@/components/wallet/send/NumpadStep'
import { RecipientStep } from '@/components/wallet/send/RecipientStep'
import {
  ConfirmStep,
  INSUFFICIENT_BALANCE_MESSAGE,
} from '@/components/wallet/send/ConfirmStep'
import { SuccessStep } from '@/components/wallet/send/SuccessStep'

const EUR_SYMBOL = '€'

/**
 * The multi-step send/request flow: amount, recipient, confirmation, success. Send executes a real
 * Leafy Pay transfer; request writes a record the target can pay from their notifications.
 * @param {object} props
 * @param {object} [props.initialContact] - Pre-fills the recipient (skips the recipient step).
 * @param {'send'|'request'} [props.initialMode]
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 * @param {() => void} props.onClose
 */
export function SendFlow({ initialContact, initialMode = 'send', isOnline = true, onClose }) {
  const { accounts: accountsState, refresh, watchTransfer } = useWalletData()
  const accounts = accountsState.data ?? []
  const primaryAccount = accounts.find((a) => a.isDefault) ?? accounts[0]

  const mode = initialMode
  const [step, setStep] = useState('numpad')
  const [cents, setCents] = useState(0)
  const [recipient, setRecipient] = useState(initialContact || null)
  const [note, setNote] = useState('')
  const [fromRef, setFromRef] = useState(null)
  const [sentReference, setSentReference] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fromAccount = accounts.find((a) => a.reference === fromRef) ?? primaryAccount
  const balanceValue = fromAccount?.balanceValue ?? 0
  const display = cents === 0 ? '0' : (cents / 100).toFixed(2)
  const euros = cents / 100
  const isRequest = mode === 'request'
  const insufficient = !isRequest && euros > balanceValue
  const currency = { symbol: EUR_SYMBOL, balance: formatMoney(balanceValue) }
  const shared = { display, isRequest, recipient, symbol: EUR_SYMBOL }

  function handleContinue() {
    setStep(recipient ? 'confirm' : 'recipient')
  }

  async function handleRequest() {
    setIsSubmitting(true)
    const res = await createRequest({
      counterpartyArrangementReference: recipient.reference,
      amount: euros,
      note,
      isOnline,
    })
    setIsSubmitting(false)
    if (res.ok) {
      refresh(['requests'])
      setStep('success')
    } else {
      setError(res.error || 'Could not send the request. Please try again.')
    }
  }

  async function handleSubmit() {
    setError('')
    if (isRequest) {
      await handleRequest()
      return
    }
    // Unreachable from the UI (the submit button is disabled), kept as insurance for a future caller.
    if (insufficient) {
      setError(INSUFFICIENT_BALANCE_MESSAGE)
      return
    }
    setIsSubmitting(true)
    // Offline this buffers the send on the device; the provider replays it on reconnect.
    const res = await sendMoney({
      counterpartyArrangementReference: recipient.reference,
      fromAccountReference: fromAccount?.reference,
      amount: euros,
      note,
      isOnline,
    })
    setIsSubmitting(false)
    if (!res.ok) {
      setError(res.error || 'Could not send. Please try again.')
      return
    }
    setSentReference(res.reference)
    refresh(['accounts', 'transactions'])
    // Only a real transfer settles; a queued one has no Leafy Pay reference to watch yet.
    if (isOnline) watchTransfer(res.reference)
    setStep('success')
  }

  if (step === 'numpad') {
    return (
      <NumpadStep
        display={display}
        cents={cents}
        currency={currency}
        recipient={recipient}
        mode={mode}
        setCents={setCents}
        onClose={onClose}
        onContinue={handleContinue}
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
        setNote={setNote}
        fromAccount={fromAccount}
        accounts={accounts}
        canPickAccount={accounts.length > 1}
        onPickAccount={(a) => setFromRef(a.reference)}
        insufficient={insufficient}
        remaining={formatMoney(balanceValue - euros)}
        isSubmitting={isSubmitting}
        error={error}
        onBack={() => setStep(initialContact ? 'numpad' : 'recipient')}
        onSubmit={handleSubmit}
      />
    )
  }

  return <SuccessStep {...shared} reference={sentReference} isOnline={isOnline} onClose={onClose} />
}
