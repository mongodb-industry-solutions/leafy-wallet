'use client'

import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'

/** Picks an icon glyph for a transaction based on its amount and note. */
function glyphFor(tx) {
  const note = tx.note.toLowerCase()
  if (tx.amount > 0) return 'Coin'
  if (note.includes('concert') || note.includes('movie')) return 'Calendar'
  return 'CreditCard'
}

/**
 * A single row in the Home/Activity transaction lists.
 * @param {object} props
 * @param {object} props.tx - The transaction to render.
 * @param {() => void} props.onClick - Opens the transaction's detail sheet.
 */
export function TxRow({ tx, onClick }) {
  const isInbound = tx.amount > 0

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-full bg-foreground/10 text-foreground">
        <Icon glyph={glyphFor(tx)} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{tx.name}</p>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {tx.note} ·{' '}
          <span className={cn(tx.isPending && 'text-warning')}>
            {tx.isPending ? 'Pending' : 'Completed'}
          </span>
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          isInbound ? 'text-secondary' : 'text-foreground',
        )}
      >
        {isInbound ? '+' : '−'}€{Math.abs(tx.amount).toFixed(2)}
      </span>
    </button>
  )
}
