'use client'

import { FileText, PieChart, Wallet, Waypoints } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

const TOOLS = [
  { icon: Wallet, label: 'Balance', delay: '0s' },
  { icon: PieChart, label: 'Spending', delay: '2s' },
  { icon: FileText, label: 'Draft', delay: '4s' },
]

/**
 * Animated mini-render for the Chat "checks, never guesses" step: a question drops into the LangGraph
 * router, which lights the one tool that can answer it, on a loop. Pure CSS, no images or timers.
 */
export function AssistantRoutingVisual() {
  return (
    <VisualCard className="flex w-60 flex-col items-center gap-2 px-3.5 py-4">
      {/* The question the user asks. */}
      <div className="self-end rounded-2xl rounded-br-sm bg-foreground px-2.5 py-1.5 text-[10px] font-medium text-background">
        How much did I spend?
      </div>

      {/* The packet dropping into the router. */}
      <div className="relative h-4 w-px">
        <span
          className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-primary"
          style={{ animation: 'ai-route-packet 2s ease-in-out infinite' }}
        />
      </div>

      {/* The LangGraph router, pulsing as it decides. */}
      <span
        className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-secondary"
        style={{ animation: 'home-db-pulse 2s ease-in-out infinite' }}
      >
        <Waypoints className="size-4.5" />
      </span>

      {/* The tools it can route to; one lights up at a time. */}
      <div className="mt-1 grid w-full grid-cols-3 gap-2">
        {TOOLS.map(({ icon: Icon, label, delay }) => (
          <div
            key={label}
            className="relative flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-1.5"
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-lg border border-secondary bg-secondary/10"
              style={{ animation: 'ai-tool-blink 6s ease-in-out infinite', animationDelay: delay }}
            />
            <Icon className="size-3.5 text-foreground" />
            <span className="text-[9px] font-semibold text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </VisualCard>
  )
}
