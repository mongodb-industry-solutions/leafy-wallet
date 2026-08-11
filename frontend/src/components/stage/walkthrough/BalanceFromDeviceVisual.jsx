'use client'

import { Database } from 'lucide-react'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Home "Balance from the device" step: a database on the phone emits the
 * balance, which counts in instantly with no network hop. Pure CSS, no images or timers.
 */
export function BalanceFromDeviceVisual() {
  return (
    <VisualCard className="flex w-60 flex-col items-center gap-3 p-4">
      {/* On-device store, pulsing as it serves the read. */}
      <span
        className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-secondary"
        style={{ animation: 'home-db-pulse 3s ease-in-out infinite' }}
      >
        <Database className="size-6" />
      </span>
      {/* The balance, revealed straight from local. */}
      <div
        className="text-2xl font-bold tracking-tight text-foreground"
        style={{ animation: 'home-balance-in 3s ease-in-out infinite' }}
      >
        €1,535<span className="text-muted-foreground">.20</span>
      </div>
      <p className="text-[11px] font-semibold text-muted-foreground">On device · no signal needed</p>
    </VisualCard>
  )
}
