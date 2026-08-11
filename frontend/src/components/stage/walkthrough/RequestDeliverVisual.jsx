'use client'

import { Building2, User } from 'lucide-react'
import { Peep } from '@/components/common/Peep'
import { ArrivalCheck } from '@/components/stage/walkthrough/ArrivalCheck'
import { SyncPath } from '@/components/stage/walkthrough/SyncPath'
import { VisualCard } from '@/components/stage/walkthrough/VisualCard'

// Slightly slower than the phone-to-Atlas visuals: this hop has a person at the far end.
const DELIVER_DURATION_S = 2.6

/**
 * Animated mini-render for the Request "delivered by the PSP" step: a packet flows from you through
 * the PSP into their wallet, then an approval check lands. Pure CSS, no images or timers.
 */
export function RequestDeliverVisual() {
  return (
    <VisualCard className="flex w-60 items-center justify-between px-4 py-5">
      {/* You: the requester. */}
      <div className="flex flex-col items-center gap-1">
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="size-4" />
        </span>
        <span className="text-[9px] font-medium text-muted-foreground">You</span>
      </div>

      {/* The request flowing through the PSP. */}
      <div className="mx-1 flex flex-1 flex-col items-center">
        <SyncPath
          durationS={DELIVER_DURATION_S}
          packetCount={1}
          className="mx-0 h-4 w-full flex-none"
          packetClassName="size-1.5"
        />
        <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold text-secondary">
          <Building2 className="size-2.5" /> PSP
        </span>
      </div>

      {/* The other person's wallet, approval check on arrival. */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <Peep seed="Luis" bg="c7f6d5" size={36} />
          <ArrivalCheck durationS={DELIVER_DURATION_S} />
        </div>
        <span className="text-[9px] font-medium text-muted-foreground">Approves</span>
      </div>
    </VisualCard>
  )
}
