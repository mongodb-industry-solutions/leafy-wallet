'use client'

import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/Peep'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

// Visual tones for the outcome badge + status pill.
const TONES = {
  secondary: { badge: 'bg-secondary/12 text-secondary', dot: 'bg-secondary', text: 'text-secondary' },
  warning: { badge: 'bg-warning/15 text-warning', dot: 'bg-warning', text: 'text-warning' },
  destructive: { badge: 'bg-destructive/12 text-destructive', dot: 'bg-destructive', text: 'text-destructive' },
}

/**
 * Live settlement state of a real online send, read off the shared transaction list.
 * @param {object} [tx] - The transaction row for this transfer, once it appears.
 * @returns {'pending'|'completed'|'failed'}
 */
function settlementOf(tx) {
  if (tx?.status === 'completed') return 'completed'
  if (tx?.status === 'failed' || tx?.status === 'exception') return 'failed'
  return 'pending'
}

/**
 * The outcome copy and visual tone for what the user is looking at: a request (delivered or saved),
 * an offline send, or a real send at its current settlement state.
 * @param {object} params
 * @returns {{title: string, sub: string, status: string, tone: string, glyph: string}}
 */
function viewFor({ isRequest, isOnline, settlement, symbol, display, recipientName }) {
  const amount = `${symbol}${display}`
  if (isRequest && isOnline) {
    return {
      title: 'Requested!',
      sub: `We asked ${recipientName} for ${amount}.`,
      status: 'Requested',
      tone: 'secondary',
      glyph: 'Checkmark',
    }
  }
  if (isRequest) {
    return {
      title: 'Request saved',
      sub: 'It’ll be delivered the moment you’re back online.',
      status: 'Pending',
      tone: 'warning',
      glyph: 'Pending',
    }
  }
  if (!isOnline) {
    return {
      title: 'Saved offline',
      sub: 'It’ll send automatically the moment you’re back online.',
      status: 'Pending',
      tone: 'warning',
      glyph: 'Pending',
    }
  }
  if (settlement === 'failed') {
    return {
      title: 'Send failed',
      sub: 'We couldn’t complete this transfer.',
      status: 'Failed',
      tone: 'destructive',
      glyph: 'X',
    }
  }
  if (settlement === 'completed') {
    return {
      title: 'Sent!',
      sub: `${amount} reached ${recipientName}.`,
      status: 'Completed',
      tone: 'secondary',
      glyph: 'Checkmark',
    }
  }
  return {
    title: 'Sent!',
    sub: `${amount} is on its way to ${recipientName}.`,
    status: 'Settling',
    tone: 'warning',
    glyph: 'Pending',
  }
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
  const view = viewFor({
    isRequest,
    isOnline,
    settlement: settlementOf(tx),
    symbol,
    display,
    recipientName: recipient?.name,
  })
  const tone = TONES[view.tone]

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className={cn('grid size-20 place-items-center rounded-full', tone.badge)}>
          <Icon glyph={view.glyph} size={40} />
        </div>

        <h2 className="mt-5 text-2xl font-bold">{view.title}</h2>
        <p className="mt-1.5 max-w-[260px] text-sm text-muted-foreground">{view.sub}</p>

        <Card className="mt-8 flex w-full items-center gap-3 text-left">
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
        </Card>
      </div>

      <div className="px-6 pb-6">
        <Button data-tour-target="send-done" onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    </div>
  )
}
