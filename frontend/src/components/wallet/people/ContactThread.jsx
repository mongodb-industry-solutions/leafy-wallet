'use client'

import { useEffect, useRef } from 'react'
import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { groupByDate, rowStatusOf } from '@/lib/wallet/format'
import { Peep } from '@/components/common/Peep'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { threadRows } from '@/components/wallet/people/threadRows'

/** Clock time for a bubble; the day is already on the separator above it. */
function timeOf(iso) {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** What the row did, from the user's side: the pill that opens every bubble. */
function directionOf(tx) {
  if (tx.kind === 'request') return { label: 'You requested', glyph: 'ArrowRight', isIncoming: false }
  if (tx.amount > 0) return { label: 'You received', glyph: 'ArrowLeft', isIncoming: true }
  return { label: 'You sent', glyph: 'ArrowRight', isIncoming: false }
}

/** One payment as a chat bubble: money in lands left, money out lands right. */
function ThreadBubble({ tx, onClick }) {
  const { label, glyph, isIncoming } = directionOf(tx)
  return (
    <div className={cn('flex', isIncoming ? 'justify-start' : 'justify-end')}>
      <button
        onClick={onClick}
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-3 text-left',
          isIncoming ? 'bg-card shadow-sm' : 'bg-foreground/[0.06]',
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2 py-1 text-xs font-semibold text-muted-foreground">
          <Icon glyph={glyph} size={12} />
          {label}
        </span>
        <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
          €{Math.abs(tx.amount).toFixed(2)}
        </p>
        <p className="mt-0.5 truncate text-sm text-foreground">{tx.note}</p>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {tx.isPending ? `${rowStatusOf(tx)} · ` : ''}
          {timeOf(tx.createdAt)}
        </p>
      </button>
    </div>
  )
}

function BubbleSkeleton({ isIncoming }) {
  return (
    <div className={cn('flex', isIncoming ? 'justify-start' : 'justify-end')}>
      <Skeleton className="h-28 w-40 rounded-2xl" />
    </div>
  )
}

/**
 * One contact's history as a conversation: every payment and open request between the two of you, in
 * chat order, with Send and Request waiting at the bottom. Reads from the transactions already loaded
 * for the Activity tab, so it works offline and shows a queued payment straight away.
 * @param {object} props
 * @param {object} props.contact - The contact this thread belongs to (`reference`, `name`, `seed`, `bg`).
 * @param {() => void} props.onBack - Return to the People list.
 * @param {() => void} props.onSend - Start a payment to this contact.
 * @param {() => void} props.onRequest - Start a request from this contact.
 * @param {(tx: object) => void} props.onDetail - Open a row's detail sheet.
 */
export function ContactThread({ contact, onBack, onSend, onRequest, onDetail }) {
  const { transactions: txState, requests: requestsState } = useWalletData()
  const rows = threadRows(txState.data, requestsState.data?.outgoing, contact.reference)
  const endRef = useRef(null)

  // The newest payment is the one worth seeing, and it sits at the bottom in chat order.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [rows.length])

  return (
    <div className="flex h-full w-full flex-col bg-muted">
      <header className="flex flex-none items-center gap-3 px-4 pt-6 pb-3">
        <button
          data-tour-target="thread-back"
          onClick={onBack}
          aria-label="Back to people"
          className="grid size-9 flex-none place-items-center rounded-full bg-card text-foreground shadow-sm"
        >
          <Icon glyph="ArrowLeft" size={18} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-base font-bold text-foreground">
          {contact.name}
        </p>
        <Peep seed={contact.seed} bg={contact.bg} size={36} />
      </header>

      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto overscroll-none px-4 pb-4">
        {txState.isLoading && (
          <>
            <BubbleSkeleton isIncoming />
            <BubbleSkeleton />
          </>
        )}

        {!txState.isLoading && rows.length === 0 && (
          <EmptyState
            glyph="Person"
            title="Nothing between you yet"
            subtitle={`Send ${contact.name.split(' ')[0]} money or ask for some, and it shows up here.`}
            className="mt-16"
          />
        )}

        {!txState.isLoading &&
          groupByDate(rows).map(({ date, items }) => (
            <section key={date} className="space-y-3">
              <p className="py-1 text-center text-xs font-semibold text-muted-foreground">{date}</p>
              {items.map((tx) => (
                <ThreadBubble key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
              ))}
            </section>
          ))}
        <div ref={endRef} />
      </div>

      <div className="flex flex-none items-center gap-2.5 border-t border-border bg-card px-4 pt-3 pb-8">
        <Button variant="neutral" onClick={onRequest} className="flex-1">
          <span className="inline-flex items-center gap-2">
            <Icon glyph="ArrowLeft" size={16} />
            Request
          </span>
        </Button>
        <Button data-tour-target="contact-send" onClick={onSend} className="flex-1 bg-foreground text-background">
          <span className="inline-flex items-center gap-2">
            <Icon glyph="ArrowRight" size={16} />
            Send
          </span>
        </Button>
      </div>
    </div>
  )
}
