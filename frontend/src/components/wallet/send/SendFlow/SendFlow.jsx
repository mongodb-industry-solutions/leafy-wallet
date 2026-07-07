'use client'

import { useState } from 'react'
import { CURRENCIES } from '@/lib/wallet-data'
import { NumpadStep } from '@/components/wallet/send/NumpadStep/NumpadStep'
import { RecipientStep } from '@/components/wallet/send/RecipientStep/RecipientStep'
import { ConfirmStep } from '@/components/wallet/send/ConfirmStep/ConfirmStep'
import { SuccessStep } from '@/components/wallet/send/SuccessStep/SuccessStep'

/**
 * The multi-step send/request flow: amount entry, recipient picker,
 * confirmation, and success.
 * @param {object} props
 * @param {object} [props.initialContact] - Pre-fills the recipient (skips the recipient step).
 * @param {'send'|'request'} [props.initialMode]
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 * @param {() => void} props.onClose
 */
export function SendFlow({ initialContact, initialMode = 'send', isOnline = true, onClose }) {
  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState('numpad')
  const [cents, setCents] = useState(0)
  const [currency, setCurrency] = useState(CURRENCIES[0])
  const [recipient, setRecipient] = useState(initialContact || null)
  const [note, setNote] = useState('')

  const display = cents === 0 ? '0' : (cents / 100).toFixed(2)
  const euros = cents / 100
  const balanceNum = parseFloat(currency.balance.replace(/,/g, ''))
  const isRequest = mode === 'request'

  const shared = { display, isRequest, recipient, symbol: currency.symbol }

  function handlePickMode(nextMode) {
    setMode(nextMode)
    if (cents > 0) setStep(recipient ? 'confirm' : 'recipient')
  }

  if (step === 'numpad') {
    return (
      <NumpadStep
        display={display}
        cents={cents}
        currency={currency}
        recipient={recipient}
        setCurrency={setCurrency}
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
        remaining={(balanceNum - euros).toFixed(2)}
        onBack={() => setStep(initialContact ? 'numpad' : 'recipient')}
        onSubmit={() => setStep('success')}
      />
    )
  }

  return <SuccessStep {...shared} isOnline={isOnline} onClose={onClose} />
}
