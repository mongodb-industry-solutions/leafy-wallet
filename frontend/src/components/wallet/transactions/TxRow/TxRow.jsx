'use client'

import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

/** Placeholder row matching TxRow's layout, shown while a transaction list loads. */
export function TxRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 py-3">
      <Skeleton className="size-10 flex-none rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-3.5 w-14" />
    </div>
  )
}

/** Picks an icon glyph for a row based on its kind, amount and note. */
function glyphFor(tx) {
  if (tx.kind === 'request') return 'Clock'
  const note = tx.note.toLowerCase()
  if (tx.amount > 0) return 'Coin'
  if (note.includes('concert') || note.includes('movie')) return 'Calendar'
  return 'CreditCard'
}

/**
 * A single row in the Home/Activity lists: a transaction, or a request still awaiting payment. A
 * request has moved no money, so it shows its amount without a direction.
 * @param {object} props
 * @param {object} props.tx - The transaction or awaiting-payment row to render.
 * @param {() => void} props.onClick - Opens the row's detail sheet.
 */
export function TxRow({ tx, onClick }) {
  const isRequest = tx.kind === 'request'
  const isInbound = tx.amount > 0

  let status = 'Completed'
  if (isRequest) status = 'Awaiting payment'
  else if (tx.isPending) status = 'Pending'

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-full bg-foreground/10 text-foreground">
        <Icon glyph={glyphFor(tx)} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {isRequest ? `You requested from ${tx.name}` : tx.name}
        </p>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {tx.note} · <span className={cn(tx.isPending && 'text-warning')}>{status}</span>
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          isRequest && 'text-muted-foreground',
          !isRequest && (isInbound ? 'text-secondary' : 'text-foreground'),
        )}
      >
        {isRequest ? '' : isInbound ? '+' : '−'}€{Math.abs(tx.amount).toFixed(2)}
      </span>
    </button>
  )
}
