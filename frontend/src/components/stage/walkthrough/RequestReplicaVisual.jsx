'use client'

import { Smartphone } from 'lucide-react'
import { AtlasTile } from '@/components/stage/walkthrough/AtlasTile'
import { SyncPath } from '@/components/stage/walkthrough/SyncPath'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

/**
 * Animated mini-render for the Request "kept close by" step: the request is written on the phone and
 * its copy rides up to Atlas through Sync. Pure CSS, no images or timers.
 */
export function RequestReplicaVisual() {
  return (
    <VisualCard className="flex w-60 items-center justify-between px-5 py-6">
      {/* The phone: where the request is written, so the list is readable offline. */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground"
          style={{ animation: 'home-db-pulse 2.4s ease-in-out infinite' }}
        >
          <Smartphone className="size-6" />
        </span>
        <span className="text-[9px] font-medium text-muted-foreground">On device</span>
      </div>

      {/* The copy travelling up through Sync. */}
      <SyncPath />

      {/* Atlas: the durable replica. */}
      <div className="flex flex-col items-center gap-1">
        <AtlasTile />
        <span className="text-[9px] font-medium text-muted-foreground">Atlas</span>
      </div>
    </VisualCard>
  )
}
