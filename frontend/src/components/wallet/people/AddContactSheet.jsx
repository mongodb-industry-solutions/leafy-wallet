'use client'

import { useRef, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { addContact } from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'

/**
 * Bottom-sheet form to add a contact by a registered Leafy Pay email or phone, whichever the value
 * looks like. On success it refreshes the contact list and dismisses; on a miss it shows an error.
 * @param {object} props
 * @param {() => void} props.onClose
 */
export function AddContactSheet({ onClose }) {
  const { refresh } = useWalletData()
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleEntered() {
    inputRef.current?.focus({ preventScroll: true })
  }

  async function handleSubmit(close) {
    if (!value.trim() || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    const res = await addContact({ lookupValue: value, label })
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

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Email or phone number"
            className="mb-2 h-12 w-full rounded-xl border border-border bg-muted px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name"
            className="h-12 w-full rounded-xl border border-border bg-muted px-4 text-sm outline-none placeholder:text-muted-foreground"
          />

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <Button
            onClick={() => handleSubmit(close)}
            disabled={!value.trim() || !label.trim() || isSubmitting}
            className="mt-4 w-full"
          >
            {isSubmitting ? 'Adding…' : 'Add contact'}
          </Button>
        </>
      )}
    </BottomSheet>
  )
}
