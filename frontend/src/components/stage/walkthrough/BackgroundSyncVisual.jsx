'use client'

import { Smartphone } from 'lucide-react'
import { ArrivalCheck } from '@/components/stage/walkthrough/ArrivalCheck'
import { AtlasTile } from '@/components/stage/walkthrough/AtlasTile'
import { SyncPath } from '@/components/stage/walkthrough/SyncPath'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Home "Quiet background sync" step: once online, writes on the phone
 * travel up to MongoDB Atlas and land with a checkmark. Pure CSS, no images or timers.
 */
export function BackgroundSyncVisual() {
  return (
    <VisualCard className="flex w-60 items-center justify-between px-5 py-6">
      {/* The phone: local source. */}
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
        <Smartphone className="size-6" />
      </span>

      {/* Packets flowing phone to cloud along a dotted path. */}
      <SyncPath />

      {/* Atlas: the cloud destination, checkmark on arrival. */}
      <div className="relative">
        <AtlasTile />
        <ArrivalCheck />
      </div>
    </VisualCard>
  )
}
