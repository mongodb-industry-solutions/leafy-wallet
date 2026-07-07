'use client'

import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/peep'
import { cn } from '@/lib/utils'

export function SuccessStep({ display, symbol, isRequest, recipient, online = true, onClose }) {
  const title = isRequest
    ? online
      ? 'Requested!'
      : 'Request saved'
    : online
      ? 'Sent!'
      : 'Saved offline'

  const sub = online
    ? isRequest
      ? `We asked ${recipient?.name} for ${symbol}${display}.`
      : `${symbol}${display} is on its way to ${recipient?.name}.`
    : `It’ll ${isRequest ? 'be delivered' : 'send'} automatically the moment you’re back online.`

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className={cn(
            'grid size-20 place-items-center rounded-full',
            online ? 'bg-secondary/12 text-secondary' : 'bg-warning/15 text-warning',
          )}
        >
          <Icon glyph={online ? 'Checkmark' : 'Pending'} size={40} />
        </div>

        <h2 className="mt-5 text-2xl font-bold">{title}</h2>
        <p className="mt-1.5 max-w-[260px] text-sm text-muted-foreground">{sub}</p>

        <div className="mt-8 flex w-full items-center gap-3 rounded-2xl bg-foreground/[0.06] p-4 text-left">
          <Peep seed={recipient?.seed} bg={recipient?.bg} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{recipient?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{recipient?.handle}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold tabular-nums">
              {symbol}
              {display}
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                online ? 'text-secondary' : 'text-warning',
              )}
            >
              <span className={cn('size-1.5 rounded-full', online ? 'bg-secondary' : 'bg-warning')} />
              {online ? 'Completed' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={onClose}
          className="h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground"
        >
          Done
        </button>
      </div>
    </div>
  )
}
