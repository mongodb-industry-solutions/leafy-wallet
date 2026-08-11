'use client'

import { ArrowRight, Building2, Mail } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the People "Emails are never stored" step: the typed address goes to Leafy
 * Pay, and only a masked hint comes back to keep. Pure CSS, no images or timers.
 */
export function ContactLookupVisual() {
  return (
    <VisualCard className="flex w-60 items-center gap-2 px-3.5 py-5">
      {/* The address you type, which the phone does not keep. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Mail className="size-4.5" />
        </span>
        <span className="truncate text-[10px] font-semibold text-muted-foreground line-through">
          luis@leafy.io
        </span>
        <span className="text-[9px] font-medium text-muted-foreground">not kept</span>
      </div>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />

      {/* Leafy Pay, which owns the lookup and answers with a reference. */}
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <span
          className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-secondary"
          style={{ animation: 'home-db-pulse 3.6s ease-in-out infinite' }}
        >
          <Building2 className="size-4.5" />
        </span>
        <span className="text-[9px] font-semibold text-secondary">Leafy Pay</span>
      </div>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />

      {/* The masked hint that is all the device holds. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        <span className="flex h-9 items-center rounded-xl bg-secondary/10 px-2 font-mono text-[10px] font-semibold text-secondary">
          l***@
        </span>
        <span className="text-[9px] font-medium text-muted-foreground">stored</span>
      </div>
    </VisualCard>
  )
}
