'use client'

import { useState } from 'react'
import { useConnection } from '@/components/stage/useConnection'
import { useAuthGate } from '@/components/stage/useAuthGate'
import { LoginScreen } from '@/components/stage/LoginScreen'
import { FaceIdEntry } from '@/components/stage/FaceIdEntry'
import { WalletApp } from '@/components/wallet/shell/WalletApp'

/**
 * The /mobile stage: the same phone content as DesktopShell, but edge to edge and on its own, so
 * opening the demo on a real handset feels like the actual wallet app. No bezel, no "Under the hood"
 * card, no tour - the presenter narration only makes sense next to the phone.
 *
 * The connection is still simulated (?offline=1 to boot offline, ⌘K/Ctrl+K with a keyboard), since
 * there is no off-phone toggle here.
 */
export function MobileShell() {
  const { isOnline } = useConnection()
  const { phase, user, handleAuthed, handleSignOut, handlePasswordlessFallback } = useAuthGate()
  // WalletApp reports its active screen; nothing on this route narrates it, so it is parked here.
  const [, setFlow] = useState('home')

  let content
  if (phase === 'authed') {
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
  return <main className="fixed inset-0 overflow-hidden bg-background">{content}</main>
}
