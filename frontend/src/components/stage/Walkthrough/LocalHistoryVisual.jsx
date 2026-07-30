'use client'

import { Calendar, Coins, CreditCard } from 'lucide-react'
import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'

const ICONS = { coin: Coins, calendar: Calendar, card: CreditCard }

/** Mini transaction row, mirroring the real Activity list rows. */
function MiniRow({ glyph, name, note, amount, inbound }) {
  const Glyph = ICONS[glyph]
  return (
    <div className="flex h-12 items-center gap-2.5 px-1">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Glyph className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-foreground">{name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{note}</p>
      </div>
      <span
        className={`shrink-0 text-[11px] font-semibold tabular-nums ${inbound ? 'text-secondary' : 'text-foreground'}`}
      >
        {inbound ? '+' : '−'}€{amount}
      </span>
    </div>
  )
}

/**
 * Animated mini-render for the Activity "One local source of truth" step: the full history
 * lives on the phone, so the list scrolls with no network wait. The rows loop up and down
 * behind an "on device" badge. Pure CSS (keyframes in globals.css), no images or timers.
 */
export function LocalHistoryVisual() {
  return (
    <VisualCard className="relative h-40 w-56 overflow-hidden px-3">
      <div
        className="flex flex-col divide-y divide-border"
        style={{ animation: 'activity-list-scroll 7s ease-in-out infinite' }}
      >
        <MiniRow glyph="card" name="Luis (Colleague)" note="test offline · Completed" amount="5.55" />
        <MiniRow glyph="coin" name="Amara Okafor" note="Salary · Completed" amount="1,200.00" inbound />
        <MiniRow glyph="calendar" name="Concert tickets" note="Live show · Completed" amount="42.00" />
        <MiniRow glyph="card" name="Grocery Store" note="Weekly shop · Completed" amount="38.20" />
        <MiniRow glyph="coin" name="Refund" note="Return · Completed" amount="19.99" inbound />
        <MiniRow glyph="card" name="Coffee Bar" note="Morning · Completed" amount="3.40" />
      </div>
      {/* Fades so rows appear to scroll under the frame edges. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />
    </VisualCard>
  )
}
