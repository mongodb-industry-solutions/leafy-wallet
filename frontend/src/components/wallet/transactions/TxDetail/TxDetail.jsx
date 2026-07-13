'use client'

import { useEffect, useState } from 'react'
import { Peep } from '@/components/common/Peep/Peep'
import { cn } from '@/lib/utils'

/**
 * Bottom-sheet detail view for a single transaction, sliding in on mount and
 * out before calling `onClose`.
 * @param {object} props
 * @param {object} props.tx - The transaction to show.
 * @param {() => void} props.onClose
 */
export function TxDetail({ tx, onClose }) {
  const [isVisible, setIsVisible] = useState(false)
  const isInbound = tx.amount > 0
  const abs = Math.abs(tx.amount).toFixed(2)

  // Slide in on mount; slide out on close, then unmount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const rows = [
    { label: 'Date', value: tx.date },
    { label: 'Status', value: tx.isPending ? 'Pending' : 'Completed', isStatusRow: true },
  ]

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={handleClose}
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: isVisible ? 1 : 0 }}
      />

      <div
        className="relative rounded-t-3xl border-t border-border bg-card p-5 pb-8 text-foreground transition-transform duration-300"
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transitionTimingFunction: isVisible
            ? 'cubic-bezier(0.16, 1, 0.3, 1)'
            : 'cubic-bezier(0.4, 0, 1, 1)',
        }}
      >
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/40" />

        <div className="flex flex-col items-center text-center">
          <Peep seed={tx.seed} bg={tx.bg} size={64} />
          <p className="mt-3 text-base font-bold">{tx.name}</p>
          <p className="text-sm text-muted-foreground">{tx.lookupHint}</p>
          <p
            className={cn(
              'mt-4 text-3xl font-bold tabular-nums',
              isInbound ? 'text-secondary' : 'text-foreground',
            )}
          >
            {isInbound ? '+' : '−'}€{abs}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{tx.note}</p>
        </div>

        <div className="mt-6 flex flex-col divide-y divide-border">
          {rows.map(({ label, value, isStatusRow }) => (
            <div key={label} className="flex items-center justify-between py-3 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span
                className={cn(
                  'font-medium',
                  isStatusRow ? (tx.isPending ? 'text-warning' : 'text-secondary') : 'text-foreground',
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
