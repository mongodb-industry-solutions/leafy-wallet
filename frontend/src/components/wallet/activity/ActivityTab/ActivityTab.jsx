'use client'

import { TRANSACTIONS } from '@/lib/wallet-data'
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
  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-6">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      {groupByDate(TRANSACTIONS).map(([date, txs]) => (
        <section key={date}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {date}
          </p>
          <div className="flex flex-col divide-y divide-border">
            {txs.map((tx) => (
              <TxRow key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
