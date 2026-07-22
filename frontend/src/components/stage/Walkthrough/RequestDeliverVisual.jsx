'use client'

import { Building2, Check, User } from 'lucide-react'
import { Peep } from '@/components/common/Peep/Peep'

/**
 * Animated mini-render for the Request "delivered by the PSP" step: once online, the request
 * travels through the payment platform (PSP) into the other person's wallet, and the money
 * only moves when they approve. A packet flows you → PSP → wallet, then an approval check
 * lands. Pure CSS (keyframes in globals.css), no images or timers.
 */
export function RequestDeliverVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-60 items-center justify-between rounded-2xl border border-border bg-white px-4 py-5 shadow-md">
        {/* You: the requester. */}
        <div className="flex flex-col items-center gap-1">
          <span className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground">
            <User className="size-4" />
          </span>
          <span className="text-[9px] font-medium text-muted-foreground">You</span>
        </div>

        {/* The request flowing through the PSP. */}
        <div className="relative mx-1 flex flex-1 flex-col items-center">
          <div className="relative h-4 w-full">
            <div className="absolute top-1/2 h-px w-full -translate-y-1/2 border-t border-dashed border-border" />
            <span
              className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary"
              style={{ animation: 'home-sync-packet 2.6s ease-in-out infinite' }}
            />
          </div>
          <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold text-secondary">
            <Building2 className="size-2.5" /> PSP
          </span>
        </div>

        {/* The other person's wallet, approval check on arrival. */}
        <div className="relative flex flex-col items-center gap-1">
          <div className="relative">
            <Peep seed="Luis" bg="c7f6d5" size={36} />
            <span
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              style={{ animation: 'home-sync-check 2.6s ease-in-out infinite' }}
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          </div>
          <span className="text-[9px] font-medium text-muted-foreground">Approves</span>
        </div>
      </div>
    </div>
  )
}
