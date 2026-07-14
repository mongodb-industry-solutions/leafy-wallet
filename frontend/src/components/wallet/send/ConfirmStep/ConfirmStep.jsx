'use client'

import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/Peep/Peep'
import { IconButton } from '@/components/ui/IconButton'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Third step of the send/request flow: review the amount, recipient, and
 * note before submitting.
 * @param {object} props
 * @param {string} props.display - Formatted amount.
 * @param {string} props.symbol - Currency symbol.
 * @param {boolean} props.isRequest
 * @param {object} props.recipient
 * @param {string} props.note
 * @param {string} props.remaining - Formatted balance remaining after this send.
 * @param {() => void} props.onBack
 * @param {() => void} props.onSubmit
 */
export function ConfirmStep({ display, symbol, isRequest, recipient, note, remaining, onBack, onSubmit }) {
  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex items-center gap-3 px-4 py-3">
        <IconButton onClick={onBack} aria-label="Back">
          <Icon glyph="ArrowLeft" size={18} />
        </IconButton>
        <span className="text-sm font-semibold">Review</span>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4">
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {isRequest ? 'Requesting' : 'Sending'}
          </p>
          <p className="mt-1 text-[52px] font-bold leading-none tabular-nums tracking-tight">
            {symbol}
            {display}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Peep seed={recipient.seed} bg={recipient.bg} size={48} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{isRequest ? 'From' : 'To'}</p>
            <p className="truncate text-base font-bold">{recipient.name}</p>
            <p className="truncate text-sm text-muted-foreground">{recipient.lookupHint}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {note && <Row label="For" value={note} />}
          {isRequest ? (
            <Row label="You'll receive" value={`${symbol}${display}`} />
          ) : (
            <>
              <Row label="From" value="Cash Balance" />
              <Row label="Remaining" value={`${symbol}${remaining}`} />
            </>
          )}
        </div>
      </div>

      <div className="px-4 pt-2 pb-6">
        <button
          onClick={onSubmit}
          className="h-14 w-full rounded-full bg-secondary text-base font-semibold text-secondary-foreground"
        >
          {isRequest ? `Request ${symbol}${display}` : `Send ${symbol}${display}`}
        </button>
      </div>
    </div>
  )
}
