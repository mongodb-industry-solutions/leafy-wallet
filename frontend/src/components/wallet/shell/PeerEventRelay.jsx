'use client'

import { usePeerEvents } from '@/components/wallet/shell/usePeerEvents'

/**
 * Renders nothing: it exists to sit inside the wallet's data provider and forward settled sends and
 * raised requests out to the stage, which is mounted above the provider and so cannot read it directly.
 * @param {object} props
 * @param {(event: object) => void} props.onEvent - Stable listener; see usePeerEvents.
 */
export function PeerEventRelay({ onEvent }) {
  usePeerEvents(onEvent)
  return null
}
