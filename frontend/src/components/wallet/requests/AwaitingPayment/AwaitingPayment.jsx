'use client'

import { Peep } from '@/components/common/Peep/Peep'

/** Money the user has asked for and not been paid yet - no transaction exists until it's paid. */
function AwaitingPaymentRow({ request }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Peep seed={request.seed} bg={request.bg} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">You requested from {request.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {request.note !== 'No note' ? `${request.note} · ` : ''}
          {request.date}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
        €{Math.abs(request.amount).toFixed(2)}
      </span>
    </div>
  )
}

/**
 * Requests the user raised that nobody has paid yet. Shared by Home and Activity so both read the
 * same; renders nothing when there is nothing outstanding.
 * @param {object} props
 * @param {object[]} props.requests - Pending outgoing requests, newest first.
 * @param {string} [props.className] - Section layout, which differs per screen.
 */
export function AwaitingPayment({ requests, className }) {
  if (requests.length === 0) return null

  return (
    <section className={className}>
      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Awaiting payment
      </p>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
        {requests.map((r) => (
          <AwaitingPaymentRow key={r.id} request={r} />
        ))}
      </div>
    </section>
  )
}
