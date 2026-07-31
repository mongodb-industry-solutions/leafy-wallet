'use client'

import { useCallback, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { useConnection } from '@/components/stage/useConnection'
import { useAuthGate } from '@/components/stage/useAuthGate'
import { ConnectionGlow } from '@/components/stage/ConnectionGlow'
import { PhoneFrame } from '@/components/stage/PhoneFrame'
import { ConnectionControl } from '@/components/stage/ConnectionControl'
import { LoginScreen } from '@/components/stage/LoginScreen'
import { FaceIdEntry } from '@/components/stage/FaceIdEntry'
import { Walkthrough } from '@/components/stage/walkthrough/Walkthrough'
import { WalletApp } from '@/components/wallet/shell/WalletApp'
import { WelcomeDialog } from '@/components/stage/WelcomeDialog'
import { useWelcomeGate, TOUR_INTENT_KEY } from '@/components/stage/useWelcomeGate'
import { TourController } from '@/components/stage/TourController'
import { useTourDirector } from '@/components/stage/useTourDirector'
import { TourCursor } from '@/components/stage/TourCursor'
import { LeafLogo } from '@/components/common/LeafLogo'
import { WALKTHROUGH } from '@/lib/walkthrough'

/** The presenter can disable the whole tour with ?tour=0 if it misbehaves mid-event. */
function isTourKilled() {
  return new URLSearchParams(window.location.search).get('tour') === '0'
}

/**
 * Top-level presenter stage: the phone frame beside the "Under the hood" panel. Gates the phone on the
 * real Leafy Pay session, showing the LoginScreen (SSO), the FaceID passwordless path, or the wallet app.
 * Also hosts the self-driving tour: the director sequences actions, the cursor performs them on the real
 * UI (including the off-phone connection toggle), and the walkthrough narration is pinned to each action.
 */
export function DesktopShell() {
  const { isOnline, handleToggle } = useConnection()
  const [flow, setFlow] = useState('home')
  const [isTourActive, setIsTourActive] = useState(false)

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

  const stopTour = useCallback(() => setIsTourActive(false), [])
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
    phoneContent = <WalletApp user={user} onSignOut={handleSignOut} onFlowChange={setFlow} isOnline={isOnline} />
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
        <PhoneFrame>{phoneContent}</PhoneFrame>

        <div className="flex w-[400px] max-w-[90vw] flex-col gap-3">
          <div
            className={`rounded-[2rem] border bg-card p-6 shadow-(--shadow-panel) transition-all duration-500 ${
              isTourActive ? 'border-secondary/40 ring-2 ring-secondary/25' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LeafLogo size={22} />
              <h2 className="text-base font-bold text-foreground">Built on MongoDB</h2>
            </div>

            <div className="mt-5">
              <Walkthrough flow={activeFlow} controlledStep={walkthroughStep} />
            </div>
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
