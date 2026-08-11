'use client'

import { Merge, Sparkles, Type } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Assistant "two ways to find a payment" step: the exact-term branch
 * fades in beside the meaning branch and the two fuse. Pure CSS, no images or timers.
 */
export function HybridSearchVisual() {
  return (
    <VisualCard className="flex w-60 flex-col items-center gap-2 px-3.5 py-4">
      {/* What the user asked the assistant to find. */}
      <div className="self-end rounded-2xl rounded-br-sm bg-foreground px-2.5 py-1.5 text-[10px] font-medium text-background">
        find the rent payment
      </div>

      {/* The two retrieval branches: meaning always, exact terms only online. */}
      <div className="mt-1 grid w-full grid-cols-2 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-1.5">
          <Sparkles className="size-3.5 text-foreground" />
          <span className="text-[9px] font-semibold text-muted-foreground">meaning</span>
        </div>
        <div className="relative flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-1.5">
          <span
            className="pointer-events-none absolute inset-0 rounded-lg border border-secondary bg-secondary/10"
            style={{ animation: 'ai-tool-blink 4s ease-in-out infinite' }}
          />
          <Type className="size-3.5 text-foreground" />
          <span className="text-[9px] font-semibold text-muted-foreground">exact terms</span>
        </div>
      </div>

      {/* The fusion step that ranks both branches together. */}
      <span
        className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-secondary"
        style={{ animation: 'home-db-pulse 4s ease-in-out infinite' }}
      >
        <Merge className="size-4.5" />
      </span>
      <span className="font-mono text-[9px] font-semibold text-secondary">$rankFusion</span>
      <span className="text-[9px] font-medium text-muted-foreground">exact terms: online only</span>
    </VisualCard>
  )
}
