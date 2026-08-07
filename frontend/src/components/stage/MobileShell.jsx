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
 * The /mobile stage: the same phone content as DesktopShell, but edge to edge and on its own, so
 * opening the demo on a real handset feels like the actual wallet app. No bezel, no "Under the hood"
 * card, no tour - the presenter narration only makes sense next to the phone.
 *
 * The connection toggle lives in the fake status bar, since there is no off-phone room for
 * DesktopShell's ConnectionControl. The bar is a sibling row above the app rather than an overlay,
 * so it sits above the full-screen flows (send, notifications) the way real OS chrome does without
 * any of them having to know about it.
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
