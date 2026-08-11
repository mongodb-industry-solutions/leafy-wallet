'use client'

import { useEffect, useRef } from 'react'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

/**
 * Reports what the user does *to* someone else to a listener outside the phone, so the stage can mirror
 * it on their device. Outbound only, and only once Leafy Pay has really accepted it.
 * @param {(event: {id: string, kind: 'send'|'request', peerName: string, amount: number, seed: string, bg: string}) => void} onEvent
 *   Must be stable across renders, since it is an effect dependency.
 */
export function usePeerEvents(onEvent) {
  const { settlement, transactions, requests, isOnline } = useWalletData()
  const rows = transactions.data
  const outgoing = requests.data?.outgoing
  const reportedSendRef = useRef(null)
  // Which outgoing requests were already on file, so only newly raised ones are reported. Null until
  // the first load, whose whole job is to record the baseline.
  const knownRequestsRef = useRef(null)

  useEffect(() => {
    if (settlement?.status !== 'completed' || settlement.origin !== 'send') return
    if (reportedSendRef.current === settlement.reference) return
    // The banner's own row carries the counterparty and the amount. It normally landed with the refresh
    // that settled the transfer; if not, this re-runs when the rows arrive.
    const tx = (rows ?? []).find((t) => t.reference === settlement.reference)
    if (!tx) return
    reportedSendRef.current = settlement.reference
    onEvent({
      id: `send:${settlement.reference}`,
      kind: 'send',
      peerName: tx.name,
      amount: Math.abs(tx.amount),
      seed: tx.seed,
      bg: tx.bg,
    })
  }, [settlement, rows, onEvent])

  useEffect(() => {
    if (!outgoing) return
    const known = knownRequestsRef.current
    const ids = new Set(outgoing.map((r) => r.id))
    // Only ever grows: the offline store holds fewer rows than Leafy Pay, and a row coming back into
    // view is not a request the user just raised.
    knownRequestsRef.current = known ? new Set([...known, ...ids]) : ids
    // Offline a request is only buffered on the device. It gets its real reference when the reconnect
    // replays it, and lands here as a new row then, which is the moment the payer can actually see it.
    if (!known || !isOnline) return
    const raised = outgoing.find((r) => !known.has(r.id))
    if (!raised) return
    onEvent({
      id: `request:${raised.id}`,
      kind: 'request',
      peerName: raised.name,
      amount: Math.abs(raised.amount),
      seed: raised.seed,
      bg: raised.bg,
    })
  }, [outgoing, isOnline, onEvent])
}
