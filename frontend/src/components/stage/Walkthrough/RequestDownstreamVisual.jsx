'use client'

import { Smartphone } from 'lucide-react'
import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'

/**
 * Animated mini-render for the Request "kept close by" step: a copy of every request rides
 * down through MongoDB Atlas onto the phone, so the list is still there to read offline. A
 * packet flows Atlas → phone and a request row lands in the on-device list. Pure CSS
 * (keyframes in globals.css), no images or timers.
 */
export function RequestDownstreamVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-60 items-center justify-between rounded-2xl border border-border bg-white px-5 py-6 shadow-md">
        {/* Atlas: the cloud source. */}
        <div className="flex flex-col items-center gap-1">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
            <LeafLogo size={24} />
          </span>
          <span className="text-[9px] font-medium text-muted-foreground">Atlas</span>
        </div>

        {/* The request copy flowing down to the device. */}
        <div className="relative mx-2 h-6 flex-1">
          <div className="absolute top-1/2 h-px w-full -translate-y-1/2 border-t border-dashed border-border" />
          <span
            className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary"
            style={{ animation: 'home-sync-packet 2.4s ease-in-out infinite' }}
          />
          <span
            className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary"
            style={{ animation: 'home-sync-packet 2.4s ease-in-out infinite', animationDelay: '0.8s' }}
          />
        </div>

        {/* The phone: the request list, kept close by. */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="flex size-11 items-center justify-center rounded-xl bg-card text-foreground"
            style={{ animation: 'home-db-pulse 2.4s ease-in-out infinite' }}
          >
            <Smartphone className="size-6" />
          </span>
          <span className="text-[9px] font-medium text-muted-foreground">On device</span>
        </div>
      </div>
    </div>
  )
}
