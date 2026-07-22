'use client'

import { Peep } from '@/components/common/Peep/Peep'
import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'

/**
 * Animated mini-render for the People "Name resolution" step: Leafy Pay hides who the
 * counterparty is, so the wallet's contact directory in Atlas maps the obscured reference
 * to a friendly name, backfilled on read. The masked reference resolves into an avatar and
 * name on a loop. Pure CSS (keyframes in globals.css), no images or timers.
 */
export function NameResolutionVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-60 items-center justify-between rounded-2xl border border-border bg-white px-4 py-5 shadow-md">
        {/* The obscured reference Leafy Pay returns. */}
        <div className="relative size-10 shrink-0">
          <span
            className="absolute inset-0 flex items-center justify-center rounded-full bg-card font-mono text-[11px] font-bold tracking-tight text-muted-foreground"
            style={{ animation: 'status-badge-pending 4.5s ease-in-out infinite' }}
          >
            ••••
          </span>
          {/* Resolves into the real contact avatar. */}
          <span
            className="absolute inset-0"
            style={{ animation: 'status-badge-done 4.5s ease-in-out infinite' }}
          >
            <Peep seed="Luis" bg="c7f6d5" size={40} />
          </span>
        </div>

        {/* The Atlas directory doing the lookup. */}
        <div className="flex flex-col items-center gap-1">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <LeafLogo size={18} />
          </span>
          <span className="text-[9px] font-medium text-muted-foreground">Atlas lookup</span>
        </div>

        {/* The friendly name, revealed once resolved. */}
        <div className="relative h-8 w-20 shrink-0">
          <span
            className="absolute inset-0 flex items-center rounded-lg bg-card px-2 font-mono text-[11px] font-bold text-muted-foreground"
            style={{ animation: 'status-badge-pending 4.5s ease-in-out infinite' }}
          >
            ••••••
          </span>
          <span
            className="absolute inset-0 flex flex-col justify-center leading-tight"
            style={{ animation: 'status-badge-done 4.5s ease-in-out infinite' }}
          >
            <span className="text-[11px] font-bold text-foreground">Luis</span>
            <span className="text-[9px] text-muted-foreground">Colleague</span>
          </span>
        </div>
      </div>
    </div>
  )
}
