'use client'

import { Check, Clock, CreditCard } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Activity "Every payment knows its status" step: one row settles from
 * Pending to Completed as the cloud confirms it, on a loop. Pure CSS, no images or timers.
 */
export function PaymentStatusVisual() {
  return (
    <VisualCard className="w-56 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CreditCard className="size-4" />
          {/* Status badge: clock while pending, check once confirmed. */}
          <span
            className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-warning text-warning-foreground"
            style={{ animation: 'status-badge-pending 5s ease-in-out infinite' }}
          >
            <Clock className="size-2.5" strokeWidth={3} />
          </span>
          <span
            className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            style={{ animation: 'status-badge-done 5s ease-in-out infinite' }}
          >
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-foreground">Luis (Colleague)</p>
          {/* Two stacked status labels cross-fading in place. */}
          <p className="relative h-3.5 text-[10px] font-medium">
            <span
              className="absolute inset-0 truncate text-warning"
              style={{ animation: 'status-badge-pending 5s ease-in-out infinite' }}
            >
              Sushi dinner · Pending
            </span>
            <span
              className="absolute inset-0 truncate text-muted-foreground"
              style={{ animation: 'status-badge-done 5s ease-in-out infinite' }}
            >
              Sushi dinner · Completed
            </span>
          </p>
        </div>

        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">−€5.55</span>
      </div>
    </VisualCard>
  )
}
