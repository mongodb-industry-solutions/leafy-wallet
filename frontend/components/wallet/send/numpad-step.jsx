'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { Ico } from '@/components/common/icons'
import { CURRENCIES } from '@/lib/wallet-data'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

function amountScale(len) {
  return Math.min(1, 6 / Math.max(len, 6))
}

export function NumpadStep({ display, cents, currency, recipient, setCurrency, setCents, onClose, onPick }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const digit = (d) =>
    setCents((p) => (p * 10 + parseInt(d, 10) > 9999999 ? p : p * 10 + parseInt(d, 10)))
  const backspace = () => setCents((p) => Math.floor(p / 10))
  const empty = cents === 0

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
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

        <div className="relative mt-5">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-sm font-semibold"
          >
            {currency.code}
            <Icon glyph="CaretDown" size={12} />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute left-1/2 top-full z-20 mt-2 w-40 -translate-x-1/2 rounded-2xl border border-border bg-card p-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCurrency(c)
                      setPickerOpen(false)
                    }}
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

        <p className="mt-4 text-sm text-muted-foreground">
          Balance: {currency.symbol}
          {currency.balance}
        </p>
      </div>

      <div className="grid grid-cols-3 px-4 text-center text-2xl font-medium">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => (k === '⌫' ? backspace() : k !== '.' ? digit(k) : undefined)}
            className="mx-auto grid size-16 place-items-center rounded-full text-foreground transition-colors active:bg-foreground/10"
          >
            {k === '⌫' ? <Ico.Del /> : k}
          </button>
        ))}
      </div>

      <div className="flex gap-3 px-4 pt-4 pb-6">
        <button
          onClick={() => onPick('request')}
          disabled={empty}
          className="h-14 flex-1 rounded-full bg-foreground/10 text-base font-semibold text-foreground disabled:opacity-40"
        >
          Request
        </button>
        <button
          onClick={() => onPick('send')}
          disabled={empty}
          className="h-14 flex-1 rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          Pay
        </button>
      </div>
    </div>
  )
}
