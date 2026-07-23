'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { Peep } from '@/components/common/Peep/Peep'
import { IconButton } from '@/components/ui/IconButton'
import { AccountPickerSheet } from '@/components/wallet/send/AccountPickerSheet/AccountPickerSheet'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Third step of the send/request flow: review the amount, recipient, source account, and note before
 * submitting. The source account is selectable when the user has more than one.
 * @param {object} props
 * @param {string} props.display - Formatted amount.
 * @param {string} props.symbol - Currency symbol.
 * @param {boolean} props.isRequest
 * @param {object} props.recipient
 * @param {string} props.note
 * @param {(note: string) => void} props.setNote
 * @param {object} [props.fromAccount] - The selected source account.
 * @param {object[]} [props.accounts] - All accounts (for the picker).
 * @param {boolean} [props.canPickAccount] - Whether there's more than one account to choose from.
 * @param {(account: object) => void} [props.onPickAccount]
 * @param {boolean} [props.insufficient] - The amount exceeds the source account's balance.
 * @param {string} props.remaining - Formatted balance remaining after this send.
 * @param {boolean} [props.isSubmitting] - The transfer is in flight.
 * @param {string} [props.error] - A failure message to surface.
 * @param {() => void} props.onBack
 * @param {() => void} props.onSubmit
 */
export function ConfirmStep({
  display,
  symbol,
  isRequest,
  recipient,
  note,
  setNote,
  fromAccount,
  accounts = [],
  canPickAccount,
  onPickAccount,
  insufficient,
  remaining,
  isSubmitting,
  error,
  onBack,
  onSubmit,
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  let submitLabel
  if (isSubmitting) submitLabel = 'Sending…'
  else if (isRequest) submitLabel = `Request ${symbol}${display}`
  else submitLabel = `Send ${symbol}${display}`

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex items-center gap-3 px-4 py-3">
        <IconButton onClick={onBack} aria-label="Back">
          <Icon glyph="ArrowLeft" size={18} />
        </IconButton>
        <span className="text-sm font-semibold">Review</span>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4">
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {isRequest ? 'Requesting' : 'Sending'}
          </p>
          <p className="mt-1 text-[52px] font-bold leading-none tabular-nums tracking-tight">
            {symbol}
            {display}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Peep seed={recipient.seed} bg={recipient.bg} size={48} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{isRequest ? 'From' : 'To'}</p>
            <p className="truncate text-base font-bold">{recipient.name}</p>
            <p className="truncate text-sm text-muted-foreground">{recipient.lookupHint}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Note</span>
            <input
              data-tour-target="send-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="Add a note"
              className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>
          {isRequest ? (
            <Row label="You'll receive" value={`${symbol}${display}`} />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                disabled={!canPickAccount}
                className="flex items-center justify-between gap-3 text-sm disabled:cursor-default"
              >
                <span className="text-muted-foreground">From</span>
                <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                  <span className="truncate">{fromAccount?.label ?? 'Account'}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">•••• {fromAccount?.last4}</span>
                  {canPickAccount && (
                    <Icon glyph="ChevronRight" size={14} className="shrink-0 text-muted-foreground" />
                  )}
                </span>
              </button>
              <Row label="Remaining" value={`${symbol}${remaining}`} />
            </>
          )}
        </div>
      </div>

      <div className="px-4 pt-2 pb-6">
        {insufficient && (
          <p className="mb-2 text-center text-sm text-destructive">
            Not enough balance in this account.
          </p>
        )}
        {error && !insufficient && <p className="mb-2 text-center text-sm text-destructive">{error}</p>}
        <button
          data-tour-target="send-submit"
          onClick={onSubmit}
          disabled={isSubmitting || insufficient}
          className="h-14 w-full rounded-full bg-secondary text-base font-semibold text-secondary-foreground disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>

      {isPickerOpen && (
        <AccountPickerSheet
          accounts={accounts}
          selectedReference={fromAccount?.reference}
          onSelect={onPickAccount}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  )
}
