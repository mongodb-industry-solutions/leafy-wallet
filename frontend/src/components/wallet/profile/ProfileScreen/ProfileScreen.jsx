'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { LINKED_ACCOUNT } from '@/lib/wallet-data'
import { Peep } from '@/components/common/Peep/Peep'
import { Ico } from '@/components/common/Icons/Icons'
import { cn } from '@/lib/utils'

/** A small iOS-style on/off switch. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 flex-none rounded-full transition-colors',
        checked ? 'bg-secondary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  )
}

/** A tappable row inside a settings card (label left, chevron right). */
function LinkRow({ label, sub }) {
  return (
    <button className="flex w-full items-center gap-3 py-3.5 text-left">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className="text-muted-foreground">
        <Icon glyph="ChevronRight" size={18} />
      </span>
    </button>
  )
}

/** Uppercase muted section heading above a card, with an optional leading icon. */
function SectionLabel({ icon, children }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </p>
  )
}

/**
 * Full-screen Profile view: SSO identity, masked linked Leafy Pay account, passwordless-login control, and decorative security/legal links.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onClose
 * @param {() => void} props.onSignOut
 */
export function ProfileScreen({ user, onClose, onSignOut }) {
  // Passwordless is local-only in PLAN.md (an enrolled WebCrypto key in
  // IndexedDB), mocked here as a simple on/off for this browser.
  const [isPasswordlessEnabled, setIsPasswordlessEnabled] = useState(false)
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)

  // Enabling is immediate; disabling asks for confirmation first.
  const handleTogglePasswordless = (next) => {
    if (next) {
      setIsPasswordlessEnabled(true)
    } else {
      setIsRemoveOpen(true)
    }
  }

  const handleConfirmRemove = () => {
    setIsPasswordlessEnabled(false)
    setIsRemoveOpen(false)
  }

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Back"
          className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10"
        >
          <Icon glyph="ArrowLeft" size={18} />
        </button>
        <span className="text-base font-bold">Profile</span>
      </div>

      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-8">
        <div className="flex flex-col items-center text-center">
          <Peep seed={user.seed} bg={user.bg} size={72} />
          <p className="mt-3 text-lg font-bold">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div>
          <SectionLabel icon={<Ico.Card size={13} />}>Linked account</SectionLabel>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">{LINKED_ACCOUNT.provider}</p>
            <p className="mt-2 font-mono text-xs tracking-tight text-muted-foreground tabular-nums">
              {LINKED_ACCOUNT.maskedIban}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{LINKED_ACCOUNT.currency} account</p>
          </div>
        </div>

        <div>
          <SectionLabel icon={<Ico.FaceId size={14} />}>Passwordless login</SectionLabel>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Face ID on this device</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isPasswordlessEnabled
                    ? 'Enabled. This browser can unlock without a password.'
                    : 'Sign in with Face ID instead of the full login next time.'}
                </p>
              </div>
              <Toggle
                checked={isPasswordlessEnabled}
                onChange={handleTogglePasswordless}
                label="Enable passwordless login"
              />
            </div>
          </div>
        </div>

        <div>
          <SectionLabel>Security &amp; legal</SectionLabel>
          <div className="rounded-2xl border border-border bg-card px-4 shadow-sm">
            <div className="divide-y divide-border">
              <LinkRow label="Privacy Policy" />
              <LinkRow label="Terms of Service" />
            </div>
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="h-14 w-full rounded-full border border-border bg-card text-sm font-semibold text-destructive shadow-sm"
        >
          Sign out
        </button>
      </div>

      {isRemoveOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
          <button
            aria-label="Cancel"
            onClick={() => setIsRemoveOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-xs rounded-2xl border border-border bg-card p-5 text-center shadow-xl">
            <p className="text-base font-bold">Remove Face ID?</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This turns off passwordless login on this device. You'll use the full login next time.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setIsRemoveOpen(false)}
                className="h-11 flex-1 rounded-full bg-foreground/[0.06] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="h-11 flex-1 rounded-full bg-destructive text-sm font-semibold text-destructive-foreground"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
