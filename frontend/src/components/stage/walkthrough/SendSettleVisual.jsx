'use client'

import { ArrowUp, Check, Clock } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Send "written locally, settles for real" step: the payment saves on the
 * device as Pending straight away, then flips to Completed once it settles. Pure CSS, no timers.
 */
export function SendSettleVisual() {
  return (
    <VisualCard className="flex w-56 flex-col gap-2.5 p-3.5">
      {/* The Send button you tap. */}
      <div className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-foreground text-[11px] font-semibold text-background">
        <ArrowUp className="size-3.5" /> Send €5.55
      </div>

      {/* The payment row: pending on tap, completed once settled. */}
      <div className="flex items-center gap-2.5 rounded-xl bg-muted px-2.5 py-2">
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground">
          <span
            className="absolute inset-0 flex items-center justify-center rounded-full bg-warning text-warning-foreground"
            style={{ animation: 'status-badge-pending 5s ease-in-out infinite' }}
          >
            <Clock className="size-3.5" strokeWidth={2.5} />
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            style={{ animation: 'status-badge-done 5s ease-in-out infinite' }}
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-foreground">Luis (Colleague)</p>
          <p className="relative h-3 text-[10px] font-medium">
            <span
              className="absolute inset-0 text-warning"
              style={{ animation: 'status-badge-pending 5s ease-in-out infinite' }}
            >
              Pending
            </span>
            <span
              className="absolute inset-0 text-secondary"
              style={{ animation: 'status-badge-done 5s ease-in-out infinite' }}
            >
              Completed
            </span>
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">−€5.55</span>
      </div>
    </VisualCard>
  )
}
