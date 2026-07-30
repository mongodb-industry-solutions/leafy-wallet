'use client'

import { ArrowUp, Wifi, WifiOff } from 'lucide-react'
import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'

/**
 * Animated mini-render for the Send "queued while offline" step: with no connection the
 * payment waits in an on-device queue, then sends itself the moment signal returns. The
 * badge flips offline to online and the queued chip flies out. Pure CSS (keyframes in
 * globals.css), no images or timers.
 */
export function SendQueueVisual() {
  return (
    <VisualCard className="w-56 p-3.5">
      {/* Connection badge: offline first, then back online. */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Queue</span>
        <span className="relative h-4 w-16">
          <span
            className="absolute inset-0 flex items-center justify-end gap-1 text-[9px] font-semibold text-muted-foreground"
            style={{ animation: 'status-badge-pending 4s ease-in-out infinite' }}
          >
            <WifiOff className="size-2.5" /> Offline
          </span>
          <span
            className="absolute inset-0 flex items-center justify-end gap-1 text-[9px] font-semibold text-secondary"
            style={{ animation: 'status-badge-done 4s ease-in-out infinite' }}
          >
            <Wifi className="size-2.5" /> Online
          </span>
        </span>
      </div>

      {/* The queued payment chip, released on reconnect. */}
      <div className="overflow-hidden rounded-xl border border-dashed border-border p-1.5">
        <div
          className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2"
          style={{ animation: 'send-queue-release 4s ease-in-out infinite' }}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
            <ArrowUp className="size-3" />
          </span>
          <span className="flex-1 truncate text-[11px] font-bold text-foreground">To Luis</span>
          <span className="text-[11px] font-semibold tabular-nums text-foreground">−€5.55</span>
        </div>
      </div>
    </VisualCard>
  )
}
