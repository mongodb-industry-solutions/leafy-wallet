'use client'

import Icon from '@leafygreen-ui/icon'
import { Ico } from '@/components/common/Icons/Icons'
import { IconButton } from '@/components/ui/IconButton'

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
 * @param {object} props.currency - Account currency, `{ code, symbol, balance }`.
 * @param {object} [props.recipient] - Pre-selected recipient, if any.
 * @param {boolean} [props.canRequest] - Whether a request can be addressed to the pre-selected recipient.
 * @param {(updater: (cents: number) => number) => void} props.setCents
 * @param {() => void} props.onClose
 * @param {(mode: 'send'|'request') => void} props.onPick
 */
export function NumpadStep({
  display,
  cents,
  currency,
  recipient,
  canRequest = true,
  setCents,
  onClose,
  onPick,
}) {
  const handleDigit = (d) =>
    setCents((p) => (p * 10 + parseInt(d, 10) > MAX_CENTS ? p : p * 10 + parseInt(d, 10)))
  const handleBackspace = () => setCents((p) => Math.floor(p / 10))
  const isEmpty = cents === 0

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex items-center px-4 py-3">
        <IconButton onClick={onClose} aria-label="Close">
          <Icon glyph="ArrowLeft" size={18} />
        </IconButton>
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
        {canRequest && (
          <button
            onClick={() => onPick('request')}
            disabled={isEmpty}
            className="h-14 flex-1 rounded-full bg-foreground/10 text-base font-semibold text-foreground disabled:opacity-40"
          >
            Request
          </button>
        )}
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
