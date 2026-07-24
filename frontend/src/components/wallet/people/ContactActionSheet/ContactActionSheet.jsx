'use client'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { Peep } from '@/components/common/Peep/Peep'

/**
 * Action sheet for a contact, opened from the chevron on a People row: pay them or request from them.
 * Row taps default to Send, so this is where the less-common Request lives without cluttering the row.
 * @param {object} props
 * @param {object} props.contact - The contact to act on (`name`, `lookupHint`, `seed`, `bg`).
 * @param {() => void} props.onSend - Start a payment to the contact.
 * @param {() => void} props.onRequest - Start a request from the contact.
 * @param {() => void} props.onClose - Dismiss without choosing.
 */
export function ContactActionSheet({ contact, onSend, onRequest, onClose }) {
  return (
    <BottomSheet onClose={onClose}>
      {({ close }) => (
        <>
          <div className="flex items-center gap-3">
            <Peep seed={contact.seed} bg={contact.bg} size={44} />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">{contact.name}</p>
              <p className="truncate text-sm text-muted-foreground">{contact.lookupHint}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              data-tour-target="contact-send"
              onClick={onSend}
              className="h-14 rounded-full bg-secondary text-base font-semibold text-secondary-foreground"
            >
              Send money
            </button>
            <button
              onClick={onRequest}
              className="h-14 rounded-full bg-foreground/[0.06] text-base font-semibold text-foreground"
            >
              Request money
            </button>
            <button onClick={close} className="h-12 text-sm font-semibold text-muted-foreground">
              Cancel
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
