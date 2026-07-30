'use client'

import { cn } from '@/lib/utils'

const DEFAULT_DURATION_S = 2.4
const DEFAULT_PACKET_COUNT = 2
// Stagger between packets so they read as a stream rather than one dot.
const PACKET_STAGGER_S = 0.8

/**
 * Dotted path with packets travelling along it, shared by the sync mini-renders.
 * @param {object} props
 * @param {number} [props.durationS] - Seconds for one packet to cross the path.
 * @param {number} [props.packetCount] - How many packets ride the path, staggered.
 * @param {string} [props.className] - Overrides for the path track.
 * @param {string} [props.packetClassName] - Overrides for each packet dot.
 */
export function SyncPath({
  durationS = DEFAULT_DURATION_S,
  packetCount = DEFAULT_PACKET_COUNT,
  className,
  packetClassName,
}) {
  return (
    <div className={cn('relative mx-2 h-6 flex-1', className)}>
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 border-t border-dashed border-border" />
      {Array.from({ length: packetCount }, (_, i) => (
        <span
          key={i}
          className={cn('absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary', packetClassName)}
          style={{
            animation: `home-sync-packet ${durationS}s ease-in-out infinite`,
            animationDelay: `${i * PACKET_STAGGER_S}s`,
          }}
        />
      ))}
    </div>
  )
}
