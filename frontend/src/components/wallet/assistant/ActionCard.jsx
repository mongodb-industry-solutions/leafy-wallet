'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/wallet/format'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { Peep } from '@/components/common/Peep'
import { Button } from '@/components/ui/Button'
import { DetailRow } from '@/components/ui/DetailRow'

const NO_BALANCE = ' - '

/**
 * What the confirmed card reports. A queued action has not reached Leafy Pay at all; a real send
 * settles under its reference, so its row in the activity list is the live answer.
 */
function outcomeOf({ isQueued, isRequest, transaction }) {
  if (isQueued) {
    return {
      glyph: 'Clock',
      label: isRequest ? 'Queued · sends when online' : 'Queued · pays when online',
      tone: 'text-warning',
    }
  }
  if (isRequest) return { glyph: 'Checkmark', label: 'Requested', tone: 'text-secondary' }
  if (transaction && !transaction.isPending) {
    return { glyph: 'Checkmark', label: 'Completed', tone: 'text-secondary' }
  }
  return { glyph: 'Clock', label: 'Pending', tone: 'text-warning' }
}

/** The settled card's footer: what actually happened, in the outcome's tone. */
function ConfirmedFooter({ outcome }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 border-t border-border bg-foreground/[0.04] py-3 text-sm font-semibold',
        outcome.tone,
      )}
    >
      <Icon glyph={outcome.glyph} size={16} />
      {outcome.label}
    </div>
  )
}

/** The expanded review: an editable note, the money detail, and the confirm/cancel pair. */
function ReviewPanel({
  actionData,
  isRequest,
  account,
  confirmLabel,
  isBusy,
  onEditNote,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="border-t border-border p-4">
      <label className="mb-3 block">
        <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          Note
        </span>
        <input
          value={actionData.note}
          onChange={onEditNote}
          placeholder="What’s it for?"
          className="w-full rounded-lg bg-foreground/[0.05] px-2.5 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-secondary"
        />
      </label>
      <div className="flex flex-col gap-2 text-xs">
        {isRequest ? (
          <DetailRow label="You’ll receive" value={`€${formatMoney(actionData.amount)}`} />
        ) : (
          <>
            <DetailRow label="From" value={account?.label ?? 'Account'} />
            <DetailRow
              label="Remaining"
              value={account ? `€${formatMoney(account.balanceValue - actionData.amount)}` : NO_BALANCE}
            />
          </>
        )}
      </div>
      <div className="mt-3.5 flex gap-2">
        <Button variant="neutral" size="md" onClick={onCancel} disabled={isBusy} className="flex-1">
          Cancel
        </Button>
        <Button size="md" onClick={onConfirm} disabled={isBusy} className="flex-[1.6]">
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

/** The collapsed card's only action: open the review. */
function ReviewButton({ isRequest, onReview }) {
  return (
    <div className="px-4 pb-4">
      <Button variant="neutral" size="md" onClick={onReview} className="w-full">
        Review {isRequest ? 'request' : 'payment'}
      </Button>
    </div>
  )
}

/**
 * A send/request the assistant drafts inline, reviewed and confirmed before any money moves.
 * @param {object} props
 * @param {object} props.msg - Chat message with an `actionData` payload.
 * @param {(id: string) => void} props.onConfirm - Called when the user confirms the action.
 * @param {(id: string, note: string) => void} [props.onEditNote] - Edits the draft's note before confirming.
 * @param {() => void} [props.onExpand] - Called when the card expands into review.
 */
export function ActionCard({ msg, onConfirm, onEditNote, onExpand, isBusy = false }) {
  const { accounts, transactions } = useWalletData()
  const actionData = msg.actionData
  const isRequest = actionData.mode === 'request'
  const [isReviewing, setIsReviewing] = useState(false)
  const accountRows = accounts.data ?? []
  const account = accountRows.find((a) => a.isDefault) ?? accountRows[0]
  // Reading the row back is what makes the footer flip to Completed on its own as the poll settles.
  const transaction = actionData.reference
    ? (transactions.data ?? []).find((t) => t.reference === actionData.reference)
    : undefined
  const outcome = outcomeOf({ isQueued: actionData.isQueued, isRequest, transaction })

  let confirmLabel = `${isRequest ? 'Request' : 'Send'} €${formatMoney(actionData.amount)}`
  if (isBusy) confirmLabel = isRequest ? 'Requesting…' : 'Sending…'

  // Expanding also scrolls the thread, so the taller card stays in view.
  function handleReview() {
    setIsReviewing(true)
    onExpand?.()
  }

  function handleCancelReview() {
    setIsReviewing(false)
  }

  function handleConfirm() {
    onConfirm(msg.id)
  }

  function handleEditNote(e) {
    onEditNote?.(msg.id, e.target.value)
  }

  let footer
  if (actionData.isConfirmed) {
    footer = <ConfirmedFooter outcome={outcome} />
  } else if (isReviewing) {
    footer = (
      <ReviewPanel
        actionData={actionData}
        isRequest={isRequest}
        account={account}
        confirmLabel={confirmLabel}
        isBusy={isBusy}
        onEditNote={handleEditNote}
        onCancel={handleCancelReview}
        onConfirm={handleConfirm}
      />
    )
  } else {
    footer = <ReviewButton isRequest={isRequest} onReview={handleReview} />
  }

  return (
    <div className="w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="p-4">
        <div className="flex items-center gap-3">
          {actionData.contact && (
            <Peep seed={actionData.contact.seed} bg={actionData.contact.bg} size={40} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {isRequest ? 'Request from' : 'Send to'}
            </p>
            <p className="truncate text-sm font-bold">{actionData.contact?.name}</p>
          </div>
        </div>

        <p className="mt-3 text-[2rem] font-bold leading-none tabular-nums">
          €{formatMoney(actionData.amount)}
        </p>
        {actionData.note && <p className="mt-1.5 text-sm text-muted-foreground">For {actionData.note}</p>}
      </div>

      {footer}
    </div>
  )
}
