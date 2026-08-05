'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { demoUserFor } from '@/lib/demo-users'

// Matches PhoneFrame's bezel: this is a second device on the stage, not a themed surface.
const BEZEL_COLOR = '#0a0a0a'
const BUBBLE_W_PX = 188
const BUBBLE_H_PX = 224
// Taller than the bubble on purpose: the bubble clips it, so the device keeps real phone proportions
// instead of looking like a stubby box that ends nowhere.
const MINI_PHONE_H_PX = 300
// The part of the little screen the bubble does not cut off, so the line lands in its middle.
const VISIBLE_SCREEN_PX = 206

const firstNameOf = (name) => String(name ?? '').trim().split(' ')[0]

// An incognito window, because signing in as the other profile in this one would drop the session the
// demo is running on.
const SIGN_IN_LEAD = 'Open an incognito window and log in as'

/**
 * The one line to show, phrased as the next thing the presenter can do rather than as the
 * counterparty's notification. The amount and the sender are left out: both are on the screen the nudge
 * fired from. Contacts who are not demo profiles cannot be signed in as, so they get their state instead.
 */
function toNudgeLine(event, user) {
  const selfFirst = firstNameOf(user?.name) || 'them'
  // Prefer the demo profile's own name: the row carries whatever alias the contact was saved under.
  const peer = demoUserFor({ name: event.peerName, seed: event.seed })
  const peerFirst = firstNameOf(peer?.name ?? event.peerName)

  if (event.kind === 'send') {
    // Past tense: the nudge only fires once the transfer settled, so the money is already there.
    return peer ? `${SIGN_IN_LEAD} ${peerFirst} to check it arrived` : `${peerFirst} has been paid`
  }
  return peer ? `${SIGN_IN_LEAD} ${peerFirst} to pay ${selfFirst}` : `Waiting on ${peerFirst} to pay`
}

/**
 * A thought bubble off the phone's top left bezel corner, holding a mock second device that names the
 * profile to sign in as to see the other half of what just happened. It is a prompt to the presenter,
 * not a window into anyone's account: no data is read from the other user.
 * @param {object} props
 * @param {object|null} props.event - What to prompt about, or null to show nothing. See usePeerEvents.
 * @param {{name: string, seed: string, bg: string}} [props.user] - The signed-in identity.
 */
export function PeerPhoneNudge({ event, user }) {
  const prefersReduced = useReducedMotion()
  const line = event ? toNudgeLine(event, user) : null

  return (
    <AnimatePresence>
      {line && (
        <motion.div
          key={event.id}
          aria-hidden
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, x: -14, y: 14 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, x: -10, y: 10 }}
          transition={
            prefersReduced ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 24 }
          }
          // Grows out of the corner it is attached to, rather than scaling about its own middle.
          style={{ transformOrigin: 'bottom right', width: BUBBLE_W_PX }}
          // Stands off the bezel's top left corner. The right margin is what the trailing dots occupy:
          // overlapping the phone instead would leave them sitting on top of the screen.
          className="pointer-events-none absolute -top-5 right-full z-50 mr-7"
        >
          {/* The two trailing dots that make it read as a thought, travelling back to the phone. */}
          <span className="absolute -right-4 bottom-6 size-3 rounded-full border border-border bg-card shadow-sm" />
          <span className="absolute -right-6 bottom-2 size-2 rounded-full border border-border bg-card shadow-sm" />

          <div
            className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card px-3 pt-3 shadow-[0_24px_48px_-20px_rgba(0,30,43,0.45)]"
            style={{ height: BUBBLE_H_PX }}
          >
            {/* Rounded at the top only: the bubble's bottom edge is what cuts the device off. */}
            <div
              className="mx-auto w-[148px] rounded-t-[1.4rem] px-1.5 pt-1.5"
              style={{ backgroundColor: BEZEL_COLOR, height: MINI_PHONE_H_PX }}
            >
              <div className="relative h-full rounded-t-[1.15rem] bg-muted">
                <span className="absolute left-1/2 top-2 h-1 w-7 -translate-x-1/2 rounded-full bg-foreground/15" />

                <div
                  className="flex items-center justify-center px-2.5 text-center"
                  style={{ height: VISIBLE_SCREEN_PX }}
                >
                  <p className="text-balance text-[13px] font-semibold leading-snug text-foreground">
                    {line}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
