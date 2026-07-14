'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { CONTACTS } from '@/lib/wallet-data'
import { Peep } from '@/components/common/Peep/Peep'

/**
 * The "People" tab: a searchable contact list where tapping a contact starts a send flow.
 * @param {object} props
 * @param {(contact: object) => void} props.onSendTo
 */
export function PeopleTab({ onSendTo }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const filtered = query
    ? CONTACTS.filter(
        (c) => c.name.toLowerCase().includes(query) || c.lookupHint.toLowerCase().includes(query),
      )
    : CONTACTS

  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-6">
      <h1 className="text-xl font-bold text-foreground">People</h1>

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

      {!query && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Frequent
          </p>
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
            {CONTACTS.map((c) => (
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
          {filtered.map((c) => (
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
              <span className="text-muted-foreground">
                <Icon glyph="ChevronRight" size={18} />
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No one found</p>
          )}
        </div>
      </section>
    </div>
  )
}
