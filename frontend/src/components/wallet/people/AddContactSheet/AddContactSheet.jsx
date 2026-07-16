'use client'

import { useRef, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'
import { addContact } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { BottomSheet } from '@/components/ui/BottomSheet'

// A contact is looked up by a registered Leafy Pay email or phone; Leafy Pay resolves it to a real user.
const LOOKUP_TYPES = [
  { id: 'email', label: 'Email', placeholder: 'name@email.com', inputType: 'email' },
  { id: 'phone', label: 'Phone', placeholder: '+34 600 000 000', inputType: 'tel' },
]

/**
 * Bottom-sheet form to add a contact by a registered Leafy Pay email/phone. On success it refreshes the
 * contact list and dismisses; on a miss it shows an inline error.
 * @param {object} props
 * @param {() => void} props.onClose
 */
export function AddContactSheet({ onClose }) {
  const { refresh } = useWalletData()
  const inputRef = useRef(null)
  const [lookupType, setLookupType] = useState('email')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const active = LOOKUP_TYPES.find((t) => t.id === lookupType)

  function handleEntered() {
    inputRef.current?.focus({ preventScroll: true })
  }

  function handlePickType(id) {
    setLookupType(id)
    setError('')
  }

  async function handleSubmit(close) {
    if (!value.trim() || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    const res = await addContact({ lookupType, lookupValue: value, label })
    setIsSubmitting(false)
    if (res.ok) {
      refresh(['contacts'])
      close()
    } else {
      setError(res.error)
    }
  }

  return (
    <BottomSheet onClose={onClose} onEntered={handleEntered}>
      {({ close }) => (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-base font-bold text-foreground">Add contact</p>
            <button onClick={close} aria-label="Close" className="text-muted-foreground">
              <Icon glyph="X" size={18} />
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            {LOOKUP_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => handlePickType(t.id)}
                className={cn(
                  'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
                  lookupType === t.id ? 'bg-foreground text-background' : 'bg-foreground/[0.06] text-muted-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={active.inputType}
            placeholder={active.placeholder}
            className="mb-2 h-12 w-full rounded-xl border border-border bg-muted px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name"
            className="h-12 w-full rounded-xl border border-border bg-muted px-4 text-sm outline-none placeholder:text-muted-foreground"
          />

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <button
            onClick={() => handleSubmit(close)}
            disabled={!value.trim() || !label.trim() || isSubmitting}
            className="mt-4 h-14 w-full rounded-full bg-secondary text-base font-semibold text-secondary-foreground disabled:opacity-40"
          >
            {isSubmitting ? 'Adding…' : 'Add contact'}
          </button>
        </>
      )}
    </BottomSheet>
  )
}
