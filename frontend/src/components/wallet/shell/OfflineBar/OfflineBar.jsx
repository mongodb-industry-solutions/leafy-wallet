'use client'

import { WifiOff } from 'lucide-react'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

/**
 * Persistent in-wallet notice that the connection is down, sitting just above the tab bar. Stays put
 * for as long as the app is offline rather than auto-dismissing, since it reports a state.
 */
export function OfflineBar() {
  const { isOnline } = useWalletData()
  if (isOnline) return null

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-4 bottom-24 z-30 flex items-center justify-center gap-2 rounded-full bg-foreground/90 px-3 py-2 text-xs font-semibold text-background shadow-lg backdrop-blur-sm"
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      Offline · saved on this device
    </div>
  )
}
