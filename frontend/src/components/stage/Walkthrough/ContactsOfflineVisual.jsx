'use client'

import { WifiOff } from 'lucide-react'
import { Peep } from '@/components/common/Peep/Peep'

const CONTACTS = [
  { name: 'Luis', sub: 'Colleague', seed: 'Luis', bg: 'c7f6d5' },
  { name: 'Amara', sub: 'Family', seed: 'Amara', bg: 'd8e9ff' },
  { name: 'Sofia', sub: 'Roommate', seed: 'Sofia', bg: 'ffe4d6' },
]

/**
 * Animated mini-render for the People "Available offline" step: the contact directory
 * syncs to the device, so names still resolve and you can start a payment with zero signal.
 * The list stays put as the connection drops to offline. Pure CSS (keyframes in
 * globals.css), no images or timers.
 */
export function ContactsOfflineVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-56 rounded-2xl border border-border bg-white p-3 shadow-md">
        {/* Offline badge that fades in to show the list survives no signal. */}
        <div className="mb-2 flex items-center justify-end">
          <span
            className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[9px] font-semibold text-muted-foreground"
            style={{ animation: 'status-badge-done 4s ease-in-out infinite' }}
          >
            <WifiOff className="size-2.5" /> Offline
          </span>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {CONTACTS.map((c) => (
            <div key={c.name} className="flex items-center gap-2.5 py-2">
              <Peep seed={c.seed} bg={c.bg} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-foreground">{c.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{c.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
