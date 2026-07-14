'use client'

import { getTransactions } from '@/lib/wallet/actions'
import { useAsync } from '@/lib/hooks/useAsync'
import { TxRow } from '@/components/wallet/transactions/TxRow/TxRow'

function groupByDate(transactions) {
  const groups = {}
  for (const tx of transactions) {
    ;(groups[tx.date] ||= []).push(tx)
  }
  return Object.entries(groups)
}

/**
 * The "Activity" tab: the full transaction history, grouped by date.
 * @param {object} props
 * @param {(tx: object) => void} props.onDetail - Opens the detail sheet for a transaction.
 */
export function ActivityTab({ onDetail }) {
  const { data, isLoading, error } = useAsync(getTransactions)
  const transactions = data ?? []

  let emptyMessage
  if (isLoading) emptyMessage = 'Loading…'
  else if (error) emptyMessage = "Couldn't load activity"
  else if (transactions.length === 0) emptyMessage = 'No transactions yet'

  return (
    <div className="flex flex-col gap-5 px-4 pt-8 pb-6">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      {emptyMessage && <p className="px-1 text-sm text-muted-foreground">{emptyMessage}</p>}

      {groupByDate(transactions).map(([date, txs]) => (
        <section key={date} className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {date}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
            {txs.map((tx) => (
              <TxRow key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
