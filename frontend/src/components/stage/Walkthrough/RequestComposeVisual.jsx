'use client'

import { Check, WifiOff } from 'lucide-react'
import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'

/**
 * Animated mini-render for the Request "composed anywhere" step: the request saves to the
 * phone first, so you can write it with no signal at all. A draft fills in behind an offline
 * badge, then a "saved locally" check appears. Pure CSS (keyframes in globals.css), no
 * images or timers.
 */
export function RequestComposeVisual() {
  return (
    <VisualCard className="w-56 p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-foreground">Request money</span>
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
          <WifiOff className="size-2.5" /> Offline
        </span>
      </div>

      {/* Draft fields. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground">From</span>
          <span className="text-[10px] font-semibold text-foreground">Luis (Colleague)</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground">Amount</span>
          <span className="text-[10px] font-semibold text-foreground">€12.00</span>
        </div>
      </div>

      {/* Saved-locally confirmation. */}
      <div
        className="mt-2.5 flex items-center justify-center gap-1 rounded-full bg-secondary/10 py-1.5 text-[10px] font-semibold text-secondary"
        style={{ animation: 'status-badge-done 4s ease-in-out infinite' }}
      >
        <Check className="size-3" strokeWidth={3} /> Saved on device
      </div>
    </VisualCard>
  )
}
