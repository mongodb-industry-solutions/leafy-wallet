'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { Toast } from '@/components/ui/Toast'

/**
 * Announces money arriving from someone else - a request or an inbound transfer - the way a settled
 * payment announces itself, so neither sits unseen behind the bell. Renders nothing until one lands.
 */
export function ArrivalToast() {
  const { arrival, dismissArrival, settlement } = useWalletData()
  // Both banners occupy the same slot at the top of the screen; the settlement clears itself after a
  // few seconds and this one follows.
  if (!arrival || settlement) return null

  const isRequest = arrival.kind === 'request'

  return (
    <Toast
      key={arrival.id}
      glyph={isRequest ? 'Bell' : 'ArrowDown'}
      title={isRequest ? `${arrival.name} asks you for money` : `${arrival.name} sent you money`}
      subtitle={`€${Math.abs(arrival.amount).toFixed(2)}`}
      onDismiss={dismissArrival}
    />
  )
}
