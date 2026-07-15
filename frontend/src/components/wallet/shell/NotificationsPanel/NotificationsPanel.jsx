'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { Peep } from '@/components/common/Peep/Peep'

/**
 * Bottom-sheet list of received-money notifications (derived from inbound transfers). Marks everything
 * seen once it has opened, so the bell badge clears.
 * @param {object} props
 * @param {() => void} props.onClose
 */
export function NotificationsPanel({ onClose }) {
  const { notifications, markNotificationsSeen } = useWalletData()

  return (
    <BottomSheet onClose={onClose} onEntered={markNotificationsSeen}>
      <p className="mb-4 text-base font-bold text-foreground">Notifications</p>

      {notifications.length === 0 ? (
        <EmptyState
          glyph="Bell"
          title="You're all caught up"
          subtitle="Money you receive will show up here."
        />
      ) : (
        <div className="no-scrollbar flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-3 py-3">
              <Peep seed={n.seed} bg={n.bg} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">You received money from {n.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {n.note ? `${n.note} · ` : ''}
                  {n.date}
                  {n.isPending ? ' · Pending' : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-secondary">
                +€{Math.abs(n.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
