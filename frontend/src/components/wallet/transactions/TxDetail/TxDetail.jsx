'use client'

import { Peep } from '@/components/common/Peep/Peep'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCancelRequest } from './useCancelRequest'

/** Text color for a detail row value: pending/settled tint on the status row, default otherwise. */
function valueColor(isStatusRow, isPending) {
  if (!isStatusRow) return 'text-foreground'
  return isPending ? 'text-warning' : 'text-secondary'
}

/**
 * Bottom-sheet detail view for one row of the activity list: a transaction, or a request still
 * awaiting payment, which can be withdrawn from here.
 * @param {object} props
 * @param {object} props.tx - The transaction or awaiting-payment row to show.
 * @param {() => void} props.onClose
 */
export function TxDetail({ tx, onClose }) {
  const isRequest = tx.kind === 'request'
  const isInbound = tx.amount > 0
  const abs = Math.abs(tx.amount).toFixed(2)
  const cancel = useCancelRequest(onClose)

  let status = 'Completed'
  if (isRequest) status = 'Awaiting payment'
  else if (tx.isPending) status = 'Pending'

  const rows = [
    { label: 'Date', value: tx.date },
    { label: 'Status', value: status, isStatusRow: true },
  ]

  let sign = isInbound ? '+' : '−'
  if (isRequest) sign = ''

  return (
    <>
      <BottomSheet onClose={onClose}>
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/40" />

        <div className="flex flex-col items-center text-center">
          <Peep seed={tx.seed} bg={tx.bg} size={64} />
          <p className="mt-3 text-base font-bold">
            {isRequest ? `You requested from ${tx.name}` : tx.name}
          </p>
          <p className="text-sm text-muted-foreground">{tx.lookupHint}</p>
          <p
            className={cn(
              'mt-4 text-3xl font-bold tabular-nums',
              isRequest && 'text-muted-foreground',
              !isRequest && (isInbound ? 'text-secondary' : 'text-foreground'),
            )}
          >
            {sign}€{abs}
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

        {isRequest && (
          <button
            onClick={cancel.ask}
            className="mt-5 h-11 w-full rounded-full bg-foreground/[0.06] text-sm font-semibold text-destructive"
          >
            Cancel request
          </button>
        )}
      </BottomSheet>

      {/* Sibling of the sheet, not a child: the backdrop's inset-0 must cover the screen, and inside
          the panel it would resolve against that instead. */}
      {cancel.isConfirming && (
        <ConfirmDialog
          title="Cancel this request?"
          message={`${tx.name} will no longer be able to pay it. You can always ask again.`}
          error={cancel.error}
          confirmLabel="Cancel request"
          busyLabel="Cancelling…"
          isBusy={cancel.isBusy}
          onCancel={cancel.dismiss}
          onConfirm={() => cancel.confirm(tx.reference)}
        />
      )}
    </>
  )
}
