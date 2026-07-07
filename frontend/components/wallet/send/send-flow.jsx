'use client'

import { useState } from 'react'
import { CURRENCIES } from '@/lib/wallet-data'
import { NumpadStep } from '@/components/wallet/send/numpad-step'
import { RecipientStep } from '@/components/wallet/send/recipient-step'
import { ConfirmStep } from '@/components/wallet/send/confirm-step'
import { SuccessStep } from '@/components/wallet/send/success-step'

export function SendFlow({ initialContact, initialMode = 'send', online = true, onClose }) {
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
        onPick={(nextMode) => {
          setMode(nextMode)
          if (cents > 0) setStep(recipient ? 'confirm' : 'recipient')
        }}
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

  return <SuccessStep {...shared} online={online} onClose={onClose} />
}
