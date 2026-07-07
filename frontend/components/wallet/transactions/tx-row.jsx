'use client'

import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'

export function glyphFor(tx) {
  const note = tx.note.toLowerCase()
  if (tx.amount > 0) return 'Coin'
  if (note.includes('concert') || note.includes('movie')) return 'Calendar'
  return 'CreditCard'
}

export function TxRow({ tx, onClick }) {
  const inbound = tx.amount > 0

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-full bg-foreground/10 text-foreground">
        <Icon glyph={glyphFor(tx)} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{tx.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.note} ·{' '}
          <span className={cn(tx.pending && 'font-medium text-warning')}>
            {tx.pending ? 'Pending' : 'Completed'}
          </span>
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          inbound ? 'text-secondary' : 'text-foreground',
        )}
      >
        {inbound ? '+' : '−'}€{Math.abs(tx.amount).toFixed(2)}
      </span>
    </button>
  )
}
