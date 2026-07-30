'use client'

import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { Toast } from '@/components/ui/Toast'

/**
 * Announces a transfer reaching its final state, which the settle poll can reach long after the
 * screen that sent it has closed. Renders nothing until something settles.
 */
export function SettlementToast() {
  const { settlement, dismissSettlement, transactions } = useWalletData()
  if (!settlement) return null

  const tx = (transactions.data ?? []).find((t) => t.reference === settlement.reference)
  const amount = tx ? `€${Math.abs(tx.amount).toFixed(2)}` : 'Your payment'
  const who = tx?.name ? ` to ${tx.name}` : ''
  const isCompleted = settlement.status === 'completed'

  return (
    <>
      {/* Invisible marker the self-driving tour polls for, so its cursor waits until the queued
          payment has actually settled before moving on. */}
      {isCompleted && <span data-tour-signal="settled" className="hidden" aria-hidden />}
      <Toast
        key={settlement.reference}
        glyph={isCompleted ? 'Checkmark' : 'Warning'}
        tone={isCompleted ? 'success' : 'warning'}
        title={isCompleted ? 'Payment completed' : 'Payment failed'}
        subtitle={`${amount}${who} ${isCompleted ? 'has settled' : 'could not be sent'}`}
        onDismiss={dismissSettlement}
      />
    </>
  )
}
