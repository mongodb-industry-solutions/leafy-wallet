'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { groupByDate } from '@/lib/wallet/format'
import { TxRow, TxRowSkeleton } from '@/components/wallet/transactions/TxRow'
import { ActivityEmpty } from '@/components/wallet/activity/ActivityEmpty'
import { toActivityRows } from '@/lib/wallet/requests'
import { CardList } from '@/components/ui/Card'

const SKELETON_ROWS = 6
const LOAD_ERROR_TITLE = "Couldn't load activity"

/**
 * The "Activity" tab: the full history grouped by date, with requests still awaiting payment sitting
 * inline among the payments.
 * @param {object} props
 * @param {(tx: object) => void} props.onDetail - Opens the detail sheet for a row.
 */
export function ActivityTab({ onDetail }) {
  const { transactions: txState, requests: requestsState } = useWalletData()
  const rows = toActivityRows(txState.data, requestsState.data?.outgoing)
  const showEmpty = !txState.isLoading && rows.length === 0

  return (
    <div className="flex flex-col gap-5 px-4 pt-8 pb-6">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      {txState.isLoading && (
        <CardList>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <TxRowSkeleton key={i} />
          ))}
        </CardList>
      )}

      {showEmpty && (
        <ActivityEmpty
          hasError={Boolean(txState.error)}
          errorTitle={LOAD_ERROR_TITLE}
          className="mt-16"
        />
      )}

      {!txState.isLoading &&
        groupByDate(rows).map(({ date, items }) => (
          <section key={date} className="flex flex-col gap-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {date}
            </p>
            <CardList>
              {items.map((tx) => (
                <TxRow key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
              ))}
            </CardList>
          </section>
        ))}
    </div>
  )
}
