'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { groupByDate } from '@/lib/wallet/format'
import { TxRow, TxRowSkeleton } from '@/components/wallet/transactions/TxRow/TxRow'
import { EmptyState } from '@/components/ui/EmptyState'

const SKELETON_ROWS = 6

/**
 * The "Activity" tab: the full transaction history, grouped by date.
 * @param {object} props
 * @param {(tx: object) => void} props.onDetail - Opens the detail sheet for a transaction.
 */
export function ActivityTab({ onDetail }) {
  const { transactions: txState } = useWalletData()
  const transactions = txState.data ?? []

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

      {transactions.length === 0 &&
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
