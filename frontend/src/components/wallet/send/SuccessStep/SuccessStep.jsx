'use client'

import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/Peep/Peep'
import { cn } from '@/lib/utils'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

// Visual tones for the outcome badge + status pill.
const TONES = {
  secondary: { badge: 'bg-secondary/12 text-secondary', dot: 'bg-secondary', text: 'text-secondary' },
  warning: { badge: 'bg-warning/15 text-warning', dot: 'bg-warning', text: 'text-warning' },
  destructive: { badge: 'bg-destructive/12 text-destructive', dot: 'bg-destructive', text: 'text-destructive' },
}

/**
 * Final step of the send/request flow. For a real online send it shows the live settlement status
 * (Settling → Completed) by polling; requests and offline sends resolve optimistically.
 * @param {object} props
 * @param {string} props.display - Formatted amount.
 * @param {string} props.symbol - Currency symbol.
 * @param {boolean} props.isRequest
 * @param {object} [props.recipient]
 * @param {string} [props.reference] - Transfer reference (real online send) to poll for settlement.
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 * @param {() => void} props.onClose
 */
export function SuccessStep({ display, symbol, isRequest, recipient, reference, isOnline = true, onClose }) {
  const { transactions } = useWalletData()

  // The provider polls the transfer to settlement; read the live status off the shared transaction list.
  const tx = reference ? (transactions.data ?? []).find((t) => t.reference === reference) : null
  let settlement = 'pending'
  if (tx?.status === 'completed') settlement = 'completed'
  else if (tx?.status === 'failed' || tx?.status === 'exception') settlement = 'failed'

  let view
  if (isRequest) {
    view = isOnline
      ? { title: 'Requested!', sub: `We asked ${recipient?.name} for ${symbol}${display}.`, status: 'Requested', tone: 'secondary', glyph: 'Checkmark' }
      : { title: 'Request saved', sub: `It’ll be delivered the moment you’re back online.`, status: 'Pending', tone: 'warning', glyph: 'Pending' }
  } else if (!isOnline) {
    view = { title: 'Saved offline', sub: `It’ll send automatically the moment you’re back online.`, status: 'Pending', tone: 'warning', glyph: 'Pending' }
  } else if (settlement === 'failed') {
    view = { title: 'Send failed', sub: `We couldn’t complete this transfer.`, status: 'Failed', tone: 'destructive', glyph: 'X' }
  } else if (settlement === 'completed') {
    view = { title: 'Sent!', sub: `${symbol}${display} reached ${recipient?.name}.`, status: 'Completed', tone: 'secondary', glyph: 'Checkmark' }
  } else {
    view = { title: 'Sent!', sub: `${symbol}${display} is on its way to ${recipient?.name}.`, status: 'Settling', tone: 'warning', glyph: 'Pending' }
  }

  const tone = TONES[view.tone]

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className={cn('grid size-20 place-items-center rounded-full', tone.badge)}>
          <Icon glyph={view.glyph} size={40} />
        </div>

        <h2 className="mt-5 text-2xl font-bold">{view.title}</h2>
        <p className="mt-1.5 max-w-[260px] text-sm text-muted-foreground">{view.sub}</p>

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
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', tone.text)}>
              <span className={cn('size-1.5 rounded-full', tone.dot)} />
              {view.status}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          data-tour-target="send-done"
          onClick={onClose}
          className="h-14 w-full rounded-full bg-secondary text-base font-semibold text-secondary-foreground"
        >
          Done
        </button>
      </div>
    </div>
  )
}
