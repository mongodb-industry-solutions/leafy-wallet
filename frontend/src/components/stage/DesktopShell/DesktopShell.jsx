'use client'

import { useState } from 'react'
import { useConnection } from '@/components/stage/DesktopShell/useConnection'
import { useAuthGate } from '@/components/stage/DesktopShell/useAuthGate'
import { ConnectionGlow } from '@/components/stage/ConnectionGlow/ConnectionGlow'
import { PhoneFrame } from '@/components/stage/PhoneFrame/PhoneFrame'
import { ConnectionControl } from '@/components/stage/ConnectionControl/ConnectionControl'
import { LoginScreen } from '@/components/stage/LoginScreen/LoginScreen'
import { FaceIdEntry } from '@/components/stage/FaceIdEntry/FaceIdEntry'
import { Walkthrough } from '@/components/stage/Walkthrough/Walkthrough'
import { WalletApp } from '@/components/wallet/shell/WalletApp/WalletApp'
import { WelcomeDialog } from '@/components/stage/WelcomeDialog/WelcomeDialog'
import { useWelcomeGate } from '@/components/stage/WelcomeDialog/useWelcomeGate'
import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'
import { WALKTHROUGH } from '@/lib/walkthrough'

/**
 * Top-level presenter stage: the phone frame beside the "Under the hood" panel. Gates the phone on the
 * real Leafy Pay session, showing the LoginScreen (SSO), the FaceID passwordless path, or the wallet app.
 */
export function DesktopShell() {
  const { isOnline, handleToggle } = useConnection()
  const { phase, user, handleAuthed, handleSignOut, handlePasswordlessFallback } = useAuthGate()
  const { isWelcomeOpen, showWelcome, dismissWelcome, startTour } = useWelcomeGate()
  const [flow, setFlow] = useState('home')

  // Before authentication the wallet reports no flow - narrate the sign-in itself.
  const activeFlow = phase === 'authed' ? flow : 'login'
  const shouldNudge = isOnline && Boolean(WALKTHROUGH[activeFlow]?.offlineMoment)

  let phoneContent
  if (phase === 'authed') {
    phoneContent = <WalletApp user={user} onSignOut={handleSignOut} onFlowChange={setFlow} isOnline={isOnline} />
  } else if (phase === 'faceid') {
    phoneContent = <FaceIdEntry onAuthed={handleAuthed} onFallback={handlePasswordlessFallback} />
  } else if (phase === 'login') {
    phoneContent = <LoginScreen />
  } else {
    phoneContent = <div className="h-full w-full bg-white" />
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-8 py-12">
      <ConnectionGlow isOnline={isOnline} />

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-[clamp(48px,8vw,120px)] gap-y-16">
        <PhoneFrame>{phoneContent}</PhoneFrame>

        <div className="flex w-[400px] max-w-[90vw] flex-col gap-3">
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_24px_60px_-24px_rgba(0,30,43,0.35)]">
            <div className="flex items-center gap-2.5">
              <LeafLogo size={22} />
              <h2 className="text-base font-bold text-foreground">Built on MongoDB</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              See how the {WALKTHROUGH[activeFlow].label} screen uses MongoDB Atlas and on-device storage.
            </p>

            <div className="mt-5">
              <Walkthrough flow={activeFlow} />
            </div>
          </div>

          <ConnectionControl isOnline={isOnline} onToggle={handleToggle} shouldNudge={shouldNudge} />
        </div>
      </div>

      {/* Low-prominence re-entry point: lets a presenter restart the intro between conversations. */}
      {!isWelcomeOpen && (
        <button
          type="button"
          onClick={showWelcome}
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          What is this? Watch the intro
        </button>
      )}

      {isWelcomeOpen && <WelcomeDialog onStartTour={startTour} onDismiss={dismissWelcome} />}
    </main>
  )
}
