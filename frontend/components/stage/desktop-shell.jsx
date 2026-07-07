'use client'

import { useCallback, useState } from 'react'
import { Cpu } from 'lucide-react'
import { useConnection } from '@/hooks/use-connection'
import { ConnectionGlow } from '@/components/stage/connection-glow'
import { PhoneFrame } from '@/components/stage/phone-frame'
import { ConnectionControl } from '@/components/stage/connection-control'
import { FaceIdEntry } from '@/components/stage/face-id-entry'
import { Walkthrough } from '@/components/stage/walkthrough'
import { WalletApp } from '@/components/wallet/chrome/wallet-app'
import { Frame, FrameHeader } from '@/components/ui/frame'
import { WALKTHROUGH } from '@/lib/walkthrough'

const USER = { name: 'Alex' }

export function DesktopShell() {
  const { online, toggle } = useConnection()
  const [authed, setAuthed] = useState(false)
  const [flow, setFlow] = useState('home')
  const login = useCallback(() => setAuthed(true), [])

  const nudge = online && Boolean(WALKTHROUGH[flow]?.offlineMoment)

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-8 py-12">
      <ConnectionGlow online={online} />

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-[clamp(48px,8vw,120px)] gap-y-16">
        <PhoneFrame>
          <WalletApp onSignOut={() => setAuthed(false)} onFlowChange={setFlow} online={online} />
        </PhoneFrame>

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
            <ConnectionControl online={online} onToggle={toggle} nudge={nudge} />
          </div>
        </Frame>
      </div>

      {!authed && <FaceIdEntry user={USER} onAuthed={login} />}
    </main>
  )
}
