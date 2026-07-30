'use client'

import { Smartphone } from 'lucide-react'
import { AtlasTile } from '@/components/stage/walkthrough/AtlasTile'
import { SyncPath } from '@/components/stage/walkthrough/SyncPath'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Request "kept close by" step: a copy of every request rides
 * down through MongoDB Atlas onto the phone, so the list is still there to read offline. A
 * packet flows Atlas to phone and a request row lands in the on-device list. Pure CSS
 * (keyframes in globals.css), no images or timers.
 */
export function RequestDownstreamVisual() {
  return (
    <VisualCard className="flex w-60 items-center justify-between px-5 py-6">
      {/* Atlas: the cloud source. */}
      <div className="flex flex-col items-center gap-1">
        <AtlasTile />
        <span className="text-[9px] font-medium text-muted-foreground">Atlas</span>
      </div>

      {/* The request copy flowing down to the device. */}
      <SyncPath />

      {/* The phone: the request list, kept close by. */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground"
          style={{ animation: 'home-db-pulse 2.4s ease-in-out infinite' }}
        >
          <Smartphone className="size-6" />
        </span>
        <span className="text-[9px] font-medium text-muted-foreground">On device</span>
      </div>
    </VisualCard>
  )
}
