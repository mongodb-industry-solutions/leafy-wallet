'use client'

import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/peep'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function ConfirmStep({ display, symbol, isRequest, recipient, note, remaining, onBack, onSubmit }) {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="grid size-9 place-items-center rounded-full bg-foreground/10"
        >
          <Icon glyph="ArrowLeft" size={18} />
        </button>
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

        <div className="flex items-center gap-3 rounded-2xl bg-foreground/[0.06] p-4">
          <Peep seed={recipient.seed} bg={recipient.bg} size={48} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{isRequest ? 'From' : 'To'}</p>
            <p className="truncate text-base font-bold">{recipient.name}</p>
            <p className="truncate text-sm text-muted-foreground">{recipient.handle}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-foreground/[0.06] p-4">
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
          className="h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground"
        >
          {isRequest ? `Request ${symbol}${display}` : `Send ${symbol}${display}`}
        </button>
      </div>
    </div>
  )
}
