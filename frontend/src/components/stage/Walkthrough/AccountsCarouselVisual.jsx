'use client'

import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'

/** Mini account card, mirroring the real Home carousel cards. */
function MiniCard({ name, amount }) {
  return (
    <div className="flex h-14 w-full shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-3">
      <span className="size-6 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-foreground">{name}</p>
        <p className="text-[10px] text-muted-foreground">•••• ••••</p>
      </div>
      <p className="text-[11px] font-semibold text-foreground">{amount}</p>
    </div>
  )
}

/**
 * Animated mini-render for the Home "Your accounts, cached locally" step: the account
 * cards slide as they would in the real carousel, all served from the on-device store.
 * Pure CSS (keyframes in globals.css), no images or timers.
 */
export function AccountsCarouselVisual() {
  return (
    <VisualCard className="w-52 overflow-hidden p-3">
      <div className="flex flex-col gap-2" style={{ animation: 'home-cards-slide 6s ease-in-out infinite' }}>
        <MiniCard name="Okafor Digital…" amount="1,535.20 €" />
        <MiniCard name="Savings Pot" amount="4,200.00 €" />
      </div>
    </VisualCard>
  )
}
