'use client'

import { useCallback, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { motion, useReducedMotion } from 'motion/react'
import { useConnection } from '@/components/stage/useConnection'
import { useAuthGate } from '@/components/stage/useAuthGate'
import { ConnectionGlow } from '@/components/stage/ConnectionGlow'
import { PhoneFrame } from '@/components/stage/PhoneFrame'
import { ConnectionControl } from '@/components/stage/ConnectionControl'
import { LoginScreen } from '@/components/stage/LoginScreen'
import { FaceIdEntry } from '@/components/stage/FaceIdEntry'
import { Walkthrough } from '@/components/stage/walkthrough/Walkthrough'
import { DbSyncCard } from '@/components/stage/DbSyncCard'
import { WalletApp } from '@/components/wallet/shell/WalletApp'
import { WelcomeDialog } from '@/components/stage/WelcomeDialog'
import { useWelcomeGate, TOUR_INTENT_KEY } from '@/components/stage/useWelcomeGate'
import { TourController } from '@/components/stage/TourController'
import { useTourDirector } from '@/components/stage/useTourDirector'
import { TourCursor } from '@/components/stage/TourCursor'
import { PeerPhoneNudge } from '@/components/stage/PeerPhoneNudge'
import { usePeerPhone } from '@/components/stage/usePeerPhone'
import { LeafLogo } from '@/components/common/LeafLogo'
import { WALKTHROUGH } from '@/lib/walkthrough'

/**
 * One side of the flippable info card: the shared panel chrome plus the corner flip button. `isBack`
 * hides its own backface and lets long content scroll, since the back is positioned over the front.
 */
function CardFace({ isBack, isTourActive, onFlip, title, children }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-y-auto rounded-[2rem] border bg-card p-6 shadow-(--shadow-panel) transition-colors duration-500 [backface-visibility:hidden] ${
        isTourActive ? 'border-secondary/40 ring-2 ring-secondary/25' : 'border-border'
      } ${isBack ? '[transform:rotateY(180deg)]' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <LeafLogo size={22} />
        <h2 className="flex-1 text-base font-bold text-foreground">{title}</h2>
        {/* Labelled, because an icon alone does not tell a first-time viewer there is a second face. */}
        <button
          type="button"
          data-tour-target="card-flip"
          onClick={onFlip}
          className="flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-foreground/10"
        >
          <Icon glyph={isBack ? 'Return' : 'Database'} size={14} aria-hidden="true" />
          {isBack ? 'Back' : 'See the data'}
        </button>
      </div>

      {/* Fills the fixed-height card and spreads the face's own blocks (narration up top, the step dots
          at the bottom) instead of letting them bunch up under the heading. */}
      <div className="mt-5 flex flex-1 flex-col justify-between">{children}</div>
    </div>
  )
}

/** The presenter can disable the whole tour with ?tour=0 if it misbehaves mid-event. */
function isTourKilled() {
  return new URLSearchParams(window.location.search).get('tour') === '0'
}

/**
 * Top-level presenter stage: the phone frame beside the "Under the hood" panel, gated on the real Leafy
 * Pay session. Also hosts the self-driving tour, whose cursor performs actions on the real UI.
 */
export function DesktopShell() {
  const { isOnline, handleToggle } = useConnection()
  const [flow, setFlow] = useState('home')
  const [isTourActive, setIsTourActive] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const prefersReduced = useReducedMotion()
  const peerPhone = usePeerPhone()

  // Consume a tour intent parked before the SSO round-trip. Hung off the auth event rather than
  // watched from an effect: the session resolving is the thing that happened, and reading the flag
  // here means it is consumed exactly once per sign-in.
  const handleSessionResolved = useCallback(() => {
    if (isTourKilled()) return
    if (window.sessionStorage.getItem(TOUR_INTENT_KEY) === '1') {
      window.sessionStorage.removeItem(TOUR_INTENT_KEY)
      setIsTourActive(true)
    }
  }, [])

  const { phase, user, handleAuthed, handleSignOut, handlePasswordlessFallback } =
    useAuthGate(handleSessionResolved)
  const isAuthed = phase === 'authed'
  // The FaceID unlock covers the stage, so the welcome waits it out.
  const isEntrySettled = phase === 'login' || isAuthed
  const { isWelcomeOpen, showWelcome, dismissWelcome } = useWelcomeGate(isEntrySettled)

  // The tour flips the card mid-script; ending it (finished or aborted) leaves the narration face up.
  const stopTour = useCallback(() => {
    setIsTourActive(false)
    setIsFlipped(false)
  }, [])
  const tour = useTourDirector({ isActive: isTourActive, onFinish: stopTour })
  const command = tour.command

  // Start the tour from the welcome's primary action. Pre-auth it cannot run yet (the wallet is not
  // mounted and the SSO redirect is a full navigation), so the intent is parked in sessionStorage and
  // consumed once authenticated.
  const handleWatchTour = useCallback(() => {
    dismissWelcome()
    if (isTourKilled()) return
    if (isAuthed) {
      setIsTourActive(true)
    } else {
      window.sessionStorage.setItem(TOUR_INTENT_KEY, '1')
    }
  }, [dismissWelcome, isAuthed])

  // Before authentication the wallet reports no flow - narrate the sign-in itself.
  const activeFlow = isAuthed ? flow : 'login'
  const shouldNudge = !isTourActive && isOnline && Boolean(WALKTHROUGH[activeFlow].offlineMoment)
  const walkthroughStep = isTourActive && command ? command.walkthroughStep : undefined

  let phoneContent
  if (isAuthed) {
    phoneContent = (
      <WalletApp
        user={user}
        onSignOut={handleSignOut}
        onFlowChange={setFlow}
        isOnline={isOnline}
        onPeerEvent={peerPhone.showEvent}
      />
    )
  } else if (phase === 'faceid') {
    phoneContent = <FaceIdEntry onAuthed={handleAuthed} onFallback={handlePasswordlessFallback} />
  } else if (phase === 'login') {
    phoneContent = <LoginScreen />
  } else {
    phoneContent = <div className="h-full w-full bg-white" />
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-8 py-8">
      <ConnectionGlow isOnline={isOnline} />

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-[clamp(48px,8vw,120px)] gap-y-16">
        {/* Relative, so the counterparty's mock phone can hang off this phone's top right corner. */}
        <div className="relative flex-none">
          <PhoneFrame>{phoneContent}</PhoneFrame>
          <PeerPhoneNudge event={peerPhone.event} user={user} />
        </div>

        <div className="flex w-[400px] max-w-[90vw] flex-col gap-3">
          {/* The info card flips: the walkthrough narration on the front, the two-store sync inspector
              on the back. Both faces are mounted so the rotation reveals a real back side. */}
          <div className="[perspective:1600px]">
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              // Fixed height: both faces are absolutely positioned, so the card never resizes when it
              // flips or when a step's content is shorter than the last one's.
              className="relative h-[570px] [transform-style:preserve-3d]"
            >
              <CardFace
                isTourActive={isTourActive}
                onFlip={() => setIsFlipped((f) => !f)}
                title="Built on MongoDB"
              >
                <Walkthrough flow={activeFlow} controlledStep={walkthroughStep} />
              </CardFace>

              {/* Pre-rotated, so it faces the viewer only once the container is flipped. */}
              <CardFace
                isBack
                isTourActive={isTourActive}
                onFlip={() => setIsFlipped((f) => !f)}
                title="Atlas ⇄ ObjectBox"
              >
                <DbSyncCard isOnline={isOnline} />
              </CardFace>
            </motion.div>
          </div>

          <ConnectionControl isOnline={isOnline} onToggle={handleToggle} shouldNudge={shouldNudge} />
        </div>
      </div>

      {/* Stage-level cursor: lives above everything (pointer-events-none) so it can travel from inside
          the phone to the off-phone connection toggle. */}
      {isTourActive && isAuthed && <TourCursor command={command} onStepComplete={tour.onStepComplete} />}

      {/* Swallows real clicks, which would desync the tour. The controls sit above this at z-60, and
          the tour's own clicks are dispatched straight onto the elements. */}
      {isTourActive && <div aria-hidden className="fixed inset-0 z-[55]" />}

      {/* Bottom of the stage: the tour controls while it runs, otherwise the low-prominence re-entry
          point that lets a presenter restart the intro between conversations. */}
      {isTourActive ? (
        <div className="absolute bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <TourController
            index={tour.index}
            total={tour.total}
            isPaused={tour.isPaused}
            onTogglePause={tour.togglePause}
            onExit={stopTour}
          />
        </div>
      ) : (
        !isWelcomeOpen && (
          <button
            type="button"
            onClick={showWelcome}
            className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Icon glyph="Play" size={14} className="text-secondary" aria-hidden="true" />
            Watch the intro
          </button>
        )
      )}

      {isWelcomeOpen && (
        <WelcomeDialog onStartTour={handleWatchTour} onDismiss={dismissWelcome} isAuthed={isAuthed} />
      )}
    </main>
  )
}
