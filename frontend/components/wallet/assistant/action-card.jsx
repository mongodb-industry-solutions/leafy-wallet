'use client'

import { useEffect, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { BALANCE } from '@/lib/wallet-data'
import { Peep } from '@/components/common/peep'

const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

/** A send/request the assistant drafts inline — reviewed and confirmed
 *  (Review → Cancel / Send) before any money moves. */
export function ActionCard({ msg, onConfirm, onExpand }) {
  const d = msg.actionData
  const isReq = d.mode === 'request'
  const [reviewing, setReviewing] = useState(false)

  // When the card expands into review, scroll the thread so it stays in view.
  useEffect(() => {
    if (reviewing) onExpand?.()
  }, [reviewing, onExpand])

  return (
    <div className="w-72 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-4">
        <div className="flex items-center gap-3">
          {d.contact && <Peep seed={d.contact.seed} bg={d.contact.bg} size={40} />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {isReq ? 'Request from' : 'Send to'}
            </p>
            <p className="truncate text-sm font-bold">{d.contact?.name}</p>
          </div>
        </div>

        <p className="mt-3 text-[2rem] font-bold leading-none tabular-nums">€{fmt(d.amount)}</p>
        {d.note && <p className="mt-1.5 text-sm text-muted-foreground">For {d.note}</p>}
      </div>

      {d.confirmed ? (
        <div className="flex items-center justify-center gap-1.5 border-t border-border bg-secondary/[0.07] py-3 text-sm font-semibold text-secondary">
          <Icon glyph="Checkmark" size={16} />
          {isReq ? 'Requested' : 'Sent'}
        </div>
      ) : reviewing ? (
        <div className="border-t border-border p-4">
          <div className="flex flex-col gap-2 text-xs">
            {isReq ? (
              <Row label="You’ll receive" value={`€${fmt(d.amount)}`} />
            ) : (
              <>
                <Row label="From" value="Cash Balance" />
                <Row label="Remaining" value={`€${fmt(BALANCE - d.amount)}`} />
              </>
            )}
          </div>
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={() => setReviewing(false)}
              className="h-11 flex-1 rounded-full bg-foreground/[0.08] text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(msg.id)}
              className="h-11 flex-[1.6] rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {isReq ? 'Request' : 'Send'} €{fmt(d.amount)}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <button
            onClick={() => setReviewing(true)}
            className="h-11 w-full rounded-full bg-foreground/[0.08] text-sm font-semibold"
          >
            Review {isReq ? 'request' : 'payment'}
          </button>
        </div>
      )}
    </div>
  )
}
