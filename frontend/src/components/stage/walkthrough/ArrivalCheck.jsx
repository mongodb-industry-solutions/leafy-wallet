'use client'

import { Check } from 'lucide-react'

const DEFAULT_DURATION_S = 2.4

/**
 * Check badge that lands on a sync destination once a packet arrives. Positioned absolutely, so the
 * destination it decorates has to be `relative`.
 * @param {object} props
 * @param {number} [props.durationS] - Seconds of the loop it shares with the packets.
 */
export function ArrivalCheck({ durationS = DEFAULT_DURATION_S }) {
  return (
    <span
      className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
      style={{ animation: `home-sync-check ${durationS}s ease-in-out infinite` }}
    >
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  )
}
