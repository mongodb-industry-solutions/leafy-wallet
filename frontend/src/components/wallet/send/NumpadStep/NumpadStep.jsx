'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { Ico } from '@/components/common/Icons/Icons'
import { CURRENCIES } from '@/lib/wallet-data'
import { MULTI_CURRENCY_ENABLED } from '@/lib/features'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
const MAX_CENTS = 9999999

function amountScale(len) {
  return Math.min(1, 6 / Math.max(len, 6))
}

/**
 * First step of the send/request flow: a numeric keypad for entering the
 * amount, with Request/Pay actions to advance.
 * @param {object} props
 * @param {string} props.display - Formatted amount (e.g. "12.50").
 * @param {number} props.cents - Amount in cents.
 * @param {object} props.currency - Active currency, `{ code, symbol, balance }`.
 * @param {object} [props.recipient] - Pre-selected recipient, if any.
 * @param {(currency: object) => void} props.setCurrency
 * @param {(updater: (cents: number) => number) => void} props.setCents
 * @param {() => void} props.onClose
 * @param {(mode: 'send'|'request') => void} props.onPick
 */
export function NumpadStep({ display, cents, currency, recipient, setCurrency, setCents, onClose, onPick }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const handleDigit = (d) =>
    setCents((p) => (p * 10 + parseInt(d, 10) > MAX_CENTS ? p : p * 10 + parseInt(d, 10)))
  const handleBackspace = () => setCents((p) => Math.floor(p / 10))
  const isEmpty = cents === 0

  function handleSelectCurrency(c) {
    setCurrency(c)
    setIsPickerOpen(false)
  }

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex items-center px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10"
        >
          <Icon glyph="ArrowLeft" size={18} />
        </button>
        {recipient && (
          <>
            <span className="mx-auto text-sm font-semibold text-muted-foreground">
              To {recipient.name}
            </span>
            <span className="size-9 flex-none" />
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div
          className="flex items-baseline gap-1 text-[76px] font-bold leading-none tabular-nums tracking-tight transition-transform duration-200 ease-out"
          style={{ transform: `scale(${amountScale(display.length)})` }}
        >
          <span className="text-[0.5em] text-muted-foreground">{currency.symbol}</span>
          <span>{display}</span>
        </div>

        {MULTI_CURRENCY_ENABLED && (
          <div className="relative mt-5">
            <button
              onClick={() => setIsPickerOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-sm font-semibold"
            >
              {currency.code}
              <Icon glyph="CaretDown" size={12} />
            </button>
            {isPickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsPickerOpen(false)} />
                <div className="absolute left-1/2 top-full z-20 mt-2 w-40 -translate-x-1/2 rounded-2xl border border-border bg-card p-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleSelectCurrency(c)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">
                        {c.symbol} {c.code}
                      </span>
                      {c.code === currency.code && (
                        <span className="text-secondary">
                          <Icon glyph="Checkmark" size={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <p className="mt-4 text-sm text-muted-foreground">
          Balance: {currency.symbol}
          {currency.balance}
        </p>
      </div>

      <div className="grid grid-cols-3 px-4 text-center text-2xl font-medium">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={k === '.'}
            onClick={() => (k === '⌫' ? handleBackspace() : handleDigit(k))}
            className="mx-auto grid size-16 place-items-center rounded-full text-foreground transition-colors active:bg-foreground/10 disabled:pointer-events-none disabled:opacity-0"
          >
            {k === '⌫' ? <Ico.Del /> : k}
          </button>
        ))}
      </div>

      <div className="flex gap-3 px-4 pt-4 pb-6">
        <button
          onClick={() => onPick('request')}
          disabled={isEmpty}
          className="h-14 flex-1 rounded-full bg-foreground/10 text-base font-semibold text-foreground disabled:opacity-40"
        >
          Request
        </button>
        <button
          onClick={() => onPick('send')}
          disabled={isEmpty}
          className="h-14 flex-1 rounded-full bg-secondary text-base font-semibold text-secondary-foreground disabled:opacity-40"
        >
          Pay
        </button>
      </div>
    </div>
  )
}
