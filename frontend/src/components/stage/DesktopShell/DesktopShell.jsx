'use client'

import { useCallback, useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
import { me } from '@/lib/auth/actions'
import { hasCredential } from '@/lib/auth/authenticator'
import { useConnection } from '@/components/stage/DesktopShell/useConnection'
import { ConnectionGlow } from '@/components/stage/ConnectionGlow/ConnectionGlow'
import { PhoneFrame } from '@/components/stage/PhoneFrame/PhoneFrame'
import { ConnectionControl } from '@/components/stage/ConnectionControl/ConnectionControl'
import { LoginScreen } from '@/components/stage/LoginScreen/LoginScreen'
import { FaceIdEntry } from '@/components/stage/FaceIdEntry/FaceIdEntry'
import { Walkthrough } from '@/components/stage/Walkthrough/Walkthrough'
import { WalletApp } from '@/components/wallet/shell/WalletApp/WalletApp'
import { Frame, FrameHeader } from '@/components/ui/Frame'
import { WALKTHROUGH } from '@/lib/walkthrough'

// Brand tint used for the identity avatar until we cache a per-user color.
const AVATAR_BG = '00684A'

/**
 * Shapes the `me()` identity into the user object the wallet UI expects (Peep seed/bg + display name).
 */
function toUser(identity) {
  return {
    name: identity.name || identity.email || 'You',
    email: identity.email || '',
    seed: identity.sub,
    bg: AVATAR_BG,
    sub: identity.sub,
  }
}

/**
 * Top-level presenter stage: the phone frame beside the "Under the hood" panel. Gates the phone on the
 * real Leafy Pay session — LoginScreen (SSO), the FaceID passwordless path, or the wallet app.
 */
export function DesktopShell() {
  const { isOnline, handleToggle } = useConnection()
  // 'loading' | 'login' | 'faceid' | 'authed'
  const [phase, setPhase] = useState('loading')
  const [user, setUser] = useState(null)
  const [flow, setFlow] = useState('home')

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const identity = await me().catch(() => null)
      if (cancelled) return
      if (identity) {
        setUser(toUser(identity))
        setPhase('authed')
        return
      }
      const enrolled = await hasCredential().catch(() => false)
      if (cancelled) return
      setPhase(enrolled ? 'faceid' : 'login')
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  // Called after the FaceID/CIBA path establishes a session.
  const handleAuthed = useCallback(async () => {
    const identity = await me().catch(() => null)
    if (identity) {
      setUser(toUser(identity))
      setPhase('authed')
    } else {
      setPhase('login')
    }
  }, [])

  // Full navigation: single sign-out at Leafy Pay, then back to the app (reloads into the LoginScreen).
  const handleSignOut = useCallback(() => {
    window.location.href = '/api/auth/logout'
  }, [])

  // Credential revoked at Leafy Pay → drop back to SSO.
  const handlePasswordlessFallback = useCallback(() => setPhase('login'), [])

  const shouldNudge = isOnline && Boolean(WALKTHROUGH[flow]?.offlineMoment)

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

        <Frame className="w-[400px] max-w-[90vw] shadow-[0_24px_60px_-24px_rgba(0,30,43,0.35)]">
          <FrameHeader>
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Under the hood</h2>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The tech behind the {WALKTHROUGH[flow]?.label ?? 'Home'} screen.
            </p>
          </FrameHeader>

          <Walkthrough flow={flow} />

          <div className="mt-1">
            <ConnectionControl isOnline={isOnline} onToggle={handleToggle} shouldNudge={shouldNudge} />
          </div>
        </Frame>
      </div>
    </main>
  )
}
