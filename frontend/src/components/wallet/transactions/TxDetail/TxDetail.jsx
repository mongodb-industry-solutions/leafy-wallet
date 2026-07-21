import { Peep } from '@/components/common/Peep/Peep'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/ui/BottomSheet'

/** Text color for a detail row value: pending/settled tint on the status row, default otherwise. */
function valueColor(isStatusRow, isPending) {
  if (!isStatusRow) return 'text-foreground'
  return isPending ? 'text-warning' : 'text-secondary'
}

/**
 * Bottom-sheet detail view for a single transaction.
 * @param {object} props
 * @param {object} props.tx - The transaction to show.
 * @param {() => void} props.onClose
 */
export function TxDetail({ tx, onClose }) {
  const isInbound = tx.amount > 0
  const abs = Math.abs(tx.amount).toFixed(2)

  const rows = [
    { label: 'Date', value: tx.date },
    { label: 'Status', value: tx.isPending ? 'Pending' : 'Completed', isStatusRow: true },
  ]

  return (
    <BottomSheet onClose={onClose}>
      <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/40" />

      <div className="flex flex-col items-center text-center">
        <Peep seed={tx.seed} bg={tx.bg} size={64} />
        <p className="mt-3 text-base font-bold">{tx.name}</p>
        <p className="text-sm text-muted-foreground">{tx.lookupHint}</p>
        <p
          className={cn(
            'mt-4 text-3xl font-bold tabular-nums',
            isInbound ? 'text-secondary' : 'text-foreground',
          )}
        >
          {isInbound ? '+' : '−'}€{abs}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{tx.note}</p>
      </div>

      <div className="mt-6 flex flex-col divide-y divide-border">
        {rows.map(({ label, value, isStatusRow }) => (
          <div key={label} className="flex items-center justify-between py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('font-medium', valueColor(isStatusRow, tx.isPending))}>{value}</span>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
