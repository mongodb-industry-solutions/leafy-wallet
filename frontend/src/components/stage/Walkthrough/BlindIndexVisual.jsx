'use client'

import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'

/**
 * Animated mini-render for the People "Blind index" step: an email you type is never
 * stored - it is turned into a keyed HMAC digest so lookups still work without holding any
 * personal data. The email flows through the key and comes out as an opaque digest, on a
 * loop. Pure CSS (keyframes in globals.css), no images or timers.
 */
export function BlindIndexVisual() {
  return (
    <VisualCard className="flex w-60 items-center gap-2 px-3.5 py-5">
      {/* The raw email you enter. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Mail className="size-4.5" />
        </span>
        <span className="truncate text-[10px] font-semibold text-foreground">luis@leafy.io</span>
      </div>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />

      {/* The key that hashes it, pulsing as it works. */}
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-secondary"
        style={{ animation: 'home-db-pulse 3.6s ease-in-out infinite' }}
      >
        <KeyRound className="size-4.5" />
      </span>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />

      {/* The opaque digest that actually gets stored. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        <span className="flex h-9 items-center rounded-xl bg-secondary/10 px-2 font-mono text-[10px] font-semibold text-secondary">
          a7f…
        </span>
        <span className="text-[9px] font-medium text-muted-foreground">stored</span>
      </div>
    </VisualCard>
  )
}
