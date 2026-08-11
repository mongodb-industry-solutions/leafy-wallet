'use client'

import { Cpu, Lock } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

const TOKEN_DELAYS = ['0s', '0.5s', '1s']
// Left offset of the first token, then the gap to the next, as a percentage of the track.
const TOKEN_START_PCT = 20
const TOKEN_GAP_PCT = 30

/**
 * Animated mini-render for the Chat "stays on the machine" step: the model runs locally, so tokens
 * bounce inside a boundary they never cross, with a lock to reinforce it. Pure CSS, no timers.
 */
export function LocalModelVisual() {
  return (
    <VisualCard className="relative flex w-56 flex-col items-center gap-3 border-2 border-dashed px-4 py-5">
      {/* The boundary label: nothing leaves this machine. */}
      <span className="absolute -top-2.5 flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-semibold text-secondary-foreground">
        <Lock className="size-2.5" /> On this machine
      </span>

      {/* The local model chip, pulsing as it works. */}
      <span
        className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-secondary"
        style={{ animation: 'home-db-pulse 3s ease-in-out infinite' }}
      >
        <Cpu className="size-6" />
      </span>

      {/* Tokens bouncing within the boundary, never crossing out. */}
      <div className="relative h-4 w-32">
        {TOKEN_DELAYS.map((delay, i) => (
          <span
            key={delay}
            className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary"
            style={{
              left: `${TOKEN_START_PCT + i * TOKEN_GAP_PCT}%`,
              animation: 'ai-token-bounce 2.4s ease-in-out infinite',
              animationDelay: delay,
            }}
          />
        ))}
      </div>

      <p className="text-[10px] font-semibold text-muted-foreground">Answers never leave the device</p>
    </VisualCard>
  )
}
