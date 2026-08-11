'use client'

import { useState } from 'react'
import { useConnection } from '@/components/stage/useConnection'
import { useAuthGate } from '@/components/stage/useAuthGate'
import { LoginScreen } from '@/components/stage/LoginScreen'
import { FaceIdEntry } from '@/components/stage/FaceIdEntry'
import { MobileStatusBar } from '@/components/stage/MobileStatusBar'
import { WalletApp } from '@/components/wallet/shell/WalletApp'
import { WALKTHROUGH } from '@/lib/walkthrough'

/**
 * The /mobile stage: the same phone content as DesktopShell but edge to edge, so opening the demo on a
 * real handset feels like the wallet app. The connection toggle lives in the fake status bar.
 */
export function MobileShell() {
  const { isOnline, handleToggle } = useConnection()
  const { phase, user, handleAuthed, handleSignOut, handlePasswordlessFallback } = useAuthGate()
  const [flow, setFlow] = useState('home')
  const isAuthed = phase === 'authed'

  // Before authentication the wallet reports no flow, and the sign-in screen has no offline story.
  const activeFlow = isAuthed ? flow : 'login'
  const shouldNudge = isOnline && Boolean(WALKTHROUGH[activeFlow].offlineMoment)

  let content
  if (isAuthed) {
    content = (
      <WalletApp user={user} onSignOut={handleSignOut} onFlowChange={setFlow} isOnline={isOnline} />
    )
  } else if (phase === 'faceid') {
    content = <FaceIdEntry onAuthed={handleAuthed} onFallback={handlePasswordlessFallback} />
  } else if (phase === 'login') {
    content = <LoginScreen />
  } else {
    content = <div className="h-full w-full bg-white" />
  }

  // Fixed rather than min-h: the wallet's screens size themselves to their container and scroll
  // internally, so the page itself must never scroll or bounce behind them.
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <MobileStatusBar isOnline={isOnline} onToggle={handleToggle} shouldNudge={shouldNudge} />
      <div className="relative flex-1 overflow-hidden">{content}</div>
    </main>
  )
}
