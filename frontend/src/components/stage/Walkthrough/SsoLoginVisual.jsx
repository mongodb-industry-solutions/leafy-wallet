'use client'

import { Peep } from '@/components/common/Peep/Peep'
import { Pointer } from '@/components/common/Pointer/Pointer'
import { VisualCard } from '@/components/stage/Walkthrough/VisualCard'
import { DEMO_USERS } from '@/lib/demo-users'

// The card the cursor demonstrates: the first demo user, which is the one the story follows.
const CURSOR_TARGET = 0
const PRESS_ANIMATION = { animation: 'sso-button-press 4s ease-in-out infinite' }

/**
 * Animated mini-render of the login screen for the walkthrough: the same profile cards, divider and
 * SSO button the user is looking at, with a cursor that glides onto the first profile and taps it on
 * a loop. Pure CSS (keyframes in globals.css), no images or timers.
 */
export function SsoLoginVisual() {
  return (
    <VisualCard className="flex w-60 flex-col gap-2.5 p-3.5">
      <div className="flex justify-center gap-1.5">
        {DEMO_USERS.map((user, i) => (
          <div key={user.email} className="relative flex-1">
            <div
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-1 py-2"
              style={i === CURSOR_TARGET ? PRESS_ANIMATION : undefined}
            >
              <Peep seed={user.seed} bg={user.bg} size={30} />
              <span className="text-[9px] font-semibold text-foreground">{user.name.split(' ')[0]}</span>
            </div>
            {i === CURSOR_TARGET && (
              <>
                {/* Click feedback ring, centered where the cursor lands. */}
                <span
                  className="pointer-events-none absolute left-1/2 top-1/2 z-10 -ml-2.5 -mt-2.5 size-5 rounded-full border-2 border-secondary"
                  style={{ animation: 'sso-click-ring 4s ease-out infinite' }}
                />
                {/* The cursor rests on the card; the keyframes travel in from off-tile. It crosses
                    the later cards on the way, which paint over it without a z-index of its own. */}
                <span
                  className="pointer-events-none absolute left-1/2 top-1/2 z-10 block"
                  style={{ animation: 'sso-cursor 4s ease-in-out infinite' }}
                >
                  <Pointer className="size-6 drop-shadow" />
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex h-8 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white">
        Continue with SSO
      </div>
    </VisualCard>
  )
}
