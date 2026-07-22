'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { Peep } from '@/components/common/Peep/Peep'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const SKELETON_ROWS = 6

/** Placeholder row matching a contact row's layout, shown while contacts load. */
function ContactRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 py-3.5">
      <Skeleton className="size-11 flex-none rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/**
 * The "People" tab: a searchable contact list where tapping a contact starts a send flow, plus adding
 * one by a registered Leafy Pay email or phone number. Removing is Leafy Pay's own screen: it owns
 * the beneficiary, and the login reconcile prunes whatever is deleted there.
 * @param {object} props
 * @param {(contact: object) => void} props.onSendTo
 * @param {() => void} props.onAddContact - Opens the add-contact sheet (rendered at the shell level).
 */
export function PeopleTab({ onSendTo, onAddContact }) {
  const {
    contacts: { data, isLoading, error },
  } = useWalletData()
  const [q, setQ] = useState('')

  const contacts = data ?? []
  const query = q.trim().toLowerCase()
  const filtered = query
    ? contacts.filter(
        (c) => c.name.toLowerCase().includes(query) || c.lookupHint.toLowerCase().includes(query),
      )
    : contacts

  let empty = null
  if (error) {
    empty = { glyph: 'Warning', title: "Couldn't load contacts", subtitle: 'Check your connection and try again.' }
  } else if (filtered.length === 0) {
    empty = query
      ? { glyph: 'MagnifyingGlass', title: 'No one found', subtitle: 'Try a different name, email or number.' }
      : { glyph: 'Person', title: 'No contacts yet', subtitle: 'Tap + to add someone on Leafy Pay.' }
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">People</h1>
        <button
          onClick={onAddContact}
          aria-label="Add contact"
          className="grid size-9 place-items-center rounded-full bg-foreground text-background shadow-sm transition-opacity hover:opacity-90"
        >
          <Icon glyph="Plus" size={18} />
        </button>
      </div>

      <label className="flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 text-foreground shadow-sm">
        <span className="text-muted-foreground">
          <Icon glyph="MagnifyingGlass" size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {!query && contacts.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Frequent
          </p>
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => onSendTo(c)}
                className="flex w-16 flex-none flex-col items-center gap-1.5"
              >
                <Peep seed={c.seed} bg={c.bg} size={56} />
                <span className="w-full truncate text-center text-xs text-muted-foreground">
                  {c.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {query ? 'Results' : 'All people'}
        </p>
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
          {isLoading &&
            Array.from({ length: SKELETON_ROWS }).map((_, i) => <ContactRowSkeleton key={i} />)}
          {!isLoading &&
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onSendTo(c)}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <Peep seed={c.seed} bg={c.bg} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.lookupHint}</p>
                </div>
              </button>
            ))}
          {!isLoading && empty && <EmptyState {...empty} />}
        </div>
      </section>
    </div>
  )
}
