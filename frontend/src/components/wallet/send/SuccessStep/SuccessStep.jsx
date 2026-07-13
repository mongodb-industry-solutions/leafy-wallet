'use client'

import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/Peep/Peep'
import { cn } from '@/lib/utils'

/**
 * Final step of the send/request flow: confirms what happened (and whether
 * it's pending on the simulated connection coming back).
 * @param {object} props
 * @param {string} props.display - Formatted amount.
 * @param {string} props.symbol - Currency symbol.
 * @param {boolean} props.isRequest
 * @param {object} [props.recipient]
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 * @param {() => void} props.onClose
 */
export function SuccessStep({ display, symbol, isRequest, recipient, isOnline = true, onClose }) {
  let title
  if (isRequest) {
    title = isOnline ? 'Requested!' : 'Request saved'
  } else {
    title = isOnline ? 'Sent!' : 'Saved offline'
  }

  let sub
  if (isOnline) {
    sub = isRequest
      ? `We asked ${recipient?.name} for ${symbol}${display}.`
      : `${symbol}${display} is on its way to ${recipient?.name}.`
  } else {
    sub = `It’ll ${isRequest ? 'be delivered' : 'send'} automatically the moment you’re back online.`
  }

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className={cn(
            'grid size-20 place-items-center rounded-full',
            isOnline ? 'bg-secondary/12 text-secondary' : 'bg-warning/15 text-warning',
          )}
        >
          <Icon glyph={isOnline ? 'Checkmark' : 'Pending'} size={40} />
        </div>

        <h2 className="mt-5 text-2xl font-bold">{title}</h2>
        <p className="mt-1.5 max-w-[260px] text-sm text-muted-foreground">{sub}</p>

        <div className="mt-8 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
          <Peep seed={recipient?.seed} bg={recipient?.bg} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{recipient?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{recipient?.lookupHint}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold tabular-nums">
              {symbol}
              {display}
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                isOnline ? 'text-secondary' : 'text-warning',
              )}
            >
              <span className={cn('size-1.5 rounded-full', isOnline ? 'bg-secondary' : 'bg-warning')} />
              {isOnline ? 'Completed' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={onClose}
          className="h-14 w-full rounded-full bg-secondary text-base font-semibold text-secondary-foreground"
        >
          Done
        </button>
      </div>
    </div>
  )
}
