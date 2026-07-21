'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { groupByDate } from '@/lib/wallet/format'
import { TxRow, TxRowSkeleton } from '@/components/wallet/transactions/TxRow/TxRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { Peep } from '@/components/common/Peep/Peep'

const SKELETON_ROWS = 6

/** Money the user has asked for and not been paid yet - no transaction exists until it's paid. */
function AwaitingPaymentRow({ request }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Peep seed={request.seed} bg={request.bg} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">You requested from {request.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {request.note !== 'No note' ? `${request.note} · ` : ''}
          {request.date}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
        €{Math.abs(request.amount).toFixed(2)}
      </span>
    </div>
  )
}

/**
 * The "Activity" tab: the full transaction history, grouped by date.
 * @param {object} props
 * @param {(tx: object) => void} props.onDetail - Opens the detail sheet for a transaction.
 */
export function ActivityTab({ onDetail }) {
  const { transactions: txState, requests: requestsState } = useWalletData()
  const transactions = txState.data ?? []
  const awaitingPayment = (requestsState.data?.outgoing ?? []).filter((r) => r.status === 'pending')

  if (txState.isLoading) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-foreground">Activity</h1>
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <TxRowSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-8 pb-6">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      {awaitingPayment.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Awaiting payment
          </p>
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
            {awaitingPayment.map((r) => (
              <AwaitingPaymentRow key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      {transactions.length === 0 &&
        awaitingPayment.length === 0 &&
        (txState.error ? (
          <EmptyState
            glyph="Warning"
            title="Couldn't load activity"
            subtitle="Check your connection and try again."
            className="mt-16"
          />
        ) : (
          <EmptyState
            glyph="CreditCard"
            title="No transactions yet"
            subtitle="Your payments and requests will show up here."
            className="mt-16"
          />
        ))}

      {groupByDate(transactions).map(({ date, items }) => (
        <section key={date} className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {date}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
            {items.map((tx) => (
              <TxRow key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
