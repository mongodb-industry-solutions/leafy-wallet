'use client'

import { useState } from 'react'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
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
          Pay
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
 * Rows swipe left to clear one; "Clear all" clears the lot. Paying a request hands off to the full
 * review flow via `onPayRequest`.
 * @param {object} props
 * @param {(notification: object) => void} props.onPayRequest - Opens the pay-request review flow.
 * @param {() => void} props.onClose
 */
export function NotificationsPanel({ onPayRequest, onClose }) {
  const { notifications, markNotificationsSeen, dismissNotifications } = useWalletData()
  const { busyId, error, tryPay, handleDecline } = useRequestActions()
  const [openId, setOpenId] = useState(null)

  return (
    <BottomSheet onClose={onClose} onEntered={markNotificationsSeen}>
      {({ close }) => (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-base font-bold text-foreground">Notifications</p>
            {notifications.length > 0 && (
              <button
                onClick={() => dismissNotifications(notifications.map((n) => n.id))}
                className="text-xs font-semibold text-muted-foreground"
              >
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <EmptyState
              glyph="Bell"
              title="You're all caught up"
              subtitle="Money you receive and payment requests will show up here."
            />
          ) : (
            <>
              {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
              {/* -mx-6 lets the swipe reveal bleed to the sheet's edges; rows pad it back. */}
              <div className="no-scrollbar -mx-6 flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto">
                {notifications.map((n) => (
                  <SwipeableRow
                    key={`${n.kind}-${n.id}`}
                    isOpen={openId === n.id}
                    onOpenChange={(isOpen) => setOpenId(isOpen ? n.id : null)}
                    actionLabel="Clear"
                    onAction={() => dismissNotifications([n.id])}
                    rowClassName="gap-3 bg-card px-6 py-3"
                  >
                    <Peep seed={n.seed} bg={n.bg} size={40} />
                    {n.kind === 'request' ? (
                      <RequestRow
                        notification={n}
                        isBusy={busyId === n.id}
                        onPay={() => {
                          if (!tryPay()) return
                          close()
                          onPayRequest(n)
                        }}
                        onDecline={() => handleDecline(n.id)}
                      />
                    ) : (
                      <ReceivedRow notification={n} />
                    )}
                  </SwipeableRow>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </BottomSheet>
  )
}
