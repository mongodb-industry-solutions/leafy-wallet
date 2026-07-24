'use client'

import { Cpu, Lock } from 'lucide-react'

/**
 * Animated mini-render for the Chat "stays on the machine" step: the model runs locally, so
 * money questions never leave the demo machine. Tokens bounce inside a boundary that they
 * never cross, with a lock to reinforce it. Pure CSS (keyframes in globals.css), no images
 * or timers.
 */
export function LocalModelVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative flex w-56 flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-white px-4 py-5 shadow-md">
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
          {['0s', '0.5s', '1s'].map((delay, i) => (
            <span
              key={delay}
              className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary"
              style={{
                left: `${20 + i * 30}%`,
                animation: 'ai-token-bounce 2.4s ease-in-out infinite',
                animationDelay: delay,
              }}
            />
          ))}
        </div>

        <p className="text-[10px] font-semibold text-muted-foreground">Answers never leave the device</p>
      </div>
    </div>
  )
}
