'use client'

import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/ui/BottomSheet'

/**
 * Bottom-sheet picker for the source account of a send.
 * @param {object} props
 * @param {object[]} props.accounts
 * @param {string} [props.selectedReference]
 * @param {(account: object) => void} props.onSelect
 * @param {() => void} props.onClose
 */
export function AccountPickerSheet({ accounts, selectedReference, onSelect, onClose }) {
  function handleSelect(account, close) {
    onSelect(account)
    close()
  }

  return (
    <BottomSheet onClose={onClose}>
      {({ close }) => (
        <>
          <p className="mb-4 text-base font-bold text-foreground">Send from</p>
          <div className="flex flex-col divide-y divide-border">
            {accounts.map((a) => {
              const isSelected = a.reference === selectedReference
              return (
                <button
                  key={a.reference}
                  onClick={() => handleSelect(a, close)}
                  className="flex items-center gap-3 py-3 text-left first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{a.label}</p>
                    <p className="text-xs tracking-tight text-muted-foreground tabular-nums">
                      •••• {a.last4} · {a.amount} €
                    </p>
                  </div>
                  <span
                    className={cn(
                      'grid size-5 flex-none place-items-center rounded-full border transition-colors',
                      isSelected
                        ? 'border-secondary bg-secondary text-secondary-foreground'
                        : 'border-muted-foreground/30',
                    )}
                  >
                    {isSelected && <Icon glyph="Checkmark" size={12} />}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </BottomSheet>
  )
}
