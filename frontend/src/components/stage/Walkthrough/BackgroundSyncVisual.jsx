'use client'

import { Check, Smartphone } from 'lucide-react'
import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'

/**
 * Animated mini-render for the Home "Quiet background sync" step: once online, writes on
 * the phone travel up to MongoDB Atlas in the background, landing with a checkmark.
 * Pure CSS (keyframes in globals.css), no images or timers.
 */
export function BackgroundSyncVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-60 items-center justify-between rounded-2xl border border-border bg-white px-5 py-6 shadow-md">
        {/* The phone: local source. */}
        <span className="flex size-11 items-center justify-center rounded-xl bg-card text-foreground">
          <Smartphone className="size-6" />
        </span>

        {/* Packets flowing phone → cloud along a dotted path. */}
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

        {/* Atlas: the cloud destination, checkmark on arrival. */}
        <div className="relative">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
            <LeafLogo size={24} />
          </span>
          <span
            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            style={{ animation: 'home-sync-check 2.4s ease-in-out infinite' }}
          >
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        </div>
      </div>
    </div>
  )
}
