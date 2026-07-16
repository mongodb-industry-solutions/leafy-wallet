'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { Peep } from '@/components/common/Peep/Peep'
import { useRequestActions } from './useRequestActions'

/** A received transfer: nothing to act on. */
function ReceivedRow({ notification }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          You received money from {notification.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {notification.note ? `${notification.note} · ` : ''}
          {notification.date}
          {notification.isPending ? ' · Pending' : ''}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-secondary">
        +€{Math.abs(notification.amount).toFixed(2)}
      </span>
    </>
  )
}

/** A payment request addressed to the user, with its pay/decline controls. */
function RequestRow({ notification, isBusy, onPay, onDecline }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {notification.name} asks you for money
        </p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          €{Math.abs(notification.amount).toFixed(2)}
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {notification.note ? `${notification.note} · ` : ''}
        {notification.date}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onPay}
          disabled={isBusy}
          className="h-8 rounded-full bg-secondary px-4 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
        >
          {isBusy ? 'Paying…' : 'Pay'}
        </button>
        <button
          onClick={onDecline}
          disabled={isBusy}
          className="h-8 rounded-full bg-foreground/[0.06] px-4 text-xs font-semibold text-muted-foreground disabled:opacity-40"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

/**
 * Bottom-sheet notifications list: money received (inbound transfers) and payment requests addressed
 * to the user, newest first. Marks everything seen once it has opened, so the bell badge clears.
 * @param {object} props
 * @param {() => void} props.onClose
 */
export function NotificationsPanel({ onClose }) {
  const { notifications, markNotificationsSeen } = useWalletData()
  const { busyId, error, handlePay, handleDecline } = useRequestActions()

  return (
    <BottomSheet onClose={onClose} onEntered={markNotificationsSeen}>
      <p className="mb-4 text-base font-bold text-foreground">Notifications</p>

      {notifications.length === 0 ? (
        <EmptyState
          glyph="Bell"
          title="You're all caught up"
          subtitle="Money you receive and payment requests will show up here."
        />
      ) : (
        <>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="no-scrollbar flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={`${n.kind}-${n.id}`} className="flex items-center gap-3 py-3">
                <Peep seed={n.seed} bg={n.bg} size={40} />
                {n.kind === 'request' ? (
                  <RequestRow
                    notification={n}
                    isBusy={busyId === n.id}
                    onPay={() => handlePay(n.id)}
                    onDecline={() => handleDecline(n.id)}
                  />
                ) : (
                  <ReceivedRow notification={n} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  )
}
