'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { CONTACTS } from '@/lib/wallet-data'
import { Peep } from '@/components/common/Peep/Peep'

/**
 * Second step of the send/request flow: pick or search for a recipient and
 * add an optional note.
 * @param {object} props
 * @param {string} props.display - Formatted amount, shown in the header.
 * @param {string} props.symbol - Currency symbol.
 * @param {boolean} props.isRequest
 * @param {object} [props.recipient] - The selected recipient, if any.
 * @param {(recipient: object|null) => void} props.setRecipient
 * @param {string} props.note
 * @param {(note: string) => void} props.setNote
 * @param {() => void} props.onBack
 * @param {() => void} props.onNext
 */
export function RecipientStep({
  display,
  symbol,
  isRequest,
  recipient,
  setRecipient,
  note,
  setNote,
  onBack,
  onNext,
}) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const filtered = query
    ? CONTACTS.filter(
        (c) => c.name.toLowerCase().includes(query) || c.handle.toLowerCase().includes(query),
      )
    : CONTACTS

  function handleSelectRecipient(c) {
    setRecipient(c)
    setSearch('')
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10"
        >
          <Icon glyph="ArrowLeft" size={18} />
        </button>
        <span className="flex-1 text-center text-lg font-bold tabular-nums">
          {symbol}
          {display}
        </span>
        <span className="size-9 flex-none" />
      </div>

      <div className="px-4">
        <div className="flex items-center gap-3 py-3">
          <span className="w-10 text-sm font-medium text-muted-foreground">
            {isRequest ? 'From' : 'To'}
          </span>
          {recipient ? (
            <div className="flex items-center gap-2 rounded-full bg-foreground/10 py-1 pr-2.5 pl-1">
              <Peep seed={recipient.seed} bg={recipient.bg} size={26} />
              <span className="text-sm font-semibold">{recipient.name}</span>
              <button
                onClick={() => setRecipient(null)}
                aria-label="Remove"
                className="text-muted-foreground"
              >
                <Icon glyph="X" size={14} />
              </button>
            </div>
          ) : (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or $handle"
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3 py-3">
          <span className="w-10 text-sm font-medium text-muted-foreground">For</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested
        </p>
        <div className="flex flex-col divide-y divide-border">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectRecipient(c)}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <Peep seed={c.seed} bg={c.bg} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.handle}</p>
              </div>
              {recipient?.id === c.id && (
                <span className="text-secondary">
                  <Icon glyph="Checkmark" size={18} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 pb-6">
        <button
          onClick={onNext}
          disabled={!recipient}
          className="h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
