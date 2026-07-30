'use client'

import { ArrowUp } from 'lucide-react'
import { ArrivalCheck } from '@/components/stage/Walkthrough/ArrivalCheck'
import { AtlasTile } from '@/components/stage/Walkthrough/AtlasTile'
import { SyncPath } from '@/components/stage/Walkthrough/SyncPath'
import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'

/**
 * Animated mini-render for the Send "synced to Atlas" step: once back online, the payment
 * pushes up to MongoDB Atlas and is recorded there the moment it succeeds. A payment packet
 * flows phone to Atlas and lands with a checkmark. Pure CSS (keyframes in globals.css), no
 * images or timers.
 */
export function SendSyncVisual() {
  return (
    <VisualCard className="flex w-60 items-center justify-between px-5 py-6">
      {/* The payment on the phone, ready to push up. */}
      <span className="flex size-11 items-center justify-center rounded-xl bg-foreground text-background">
        <ArrowUp className="size-6" />
      </span>

      {/* The payment flowing up along a dotted path. */}
      <SyncPath />

      {/* Atlas records it, checkmark on success. */}
      <div className="relative">
        <AtlasTile />
        <ArrivalCheck />
      </div>
    </VisualCard>
  )
}
