'use client'

import Icon from '@leafygreen-ui/icon'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { Peep } from '@/components/common/Peep/Peep'
import { Ico } from '@/components/common/Icons/Icons'
import { usePasswordless } from '@/components/wallet/profile/ProfileScreen/usePasswordless'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

const LINKED_PROVIDER = 'Leafy Pay'

/** A small iOS-style on/off switch. */
function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 flex-none rounded-full transition-colors disabled:opacity-50',
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
 * Full-screen Profile view: SSO identity, masked linked Leafy Pay account, and the passwordless-login control.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string, sub: string}} props.user
 * @param {() => void} props.onClose
 * @param {() => void} props.onSignOut
 */
export function ProfileScreen({ user, onClose, onSignOut }) {
  const {
    isEnabled,
    isBusy,
    errorMsg,
    statusText,
    isRemoveOpen,
    handleToggle,
    handleConfirmRemove,
    handleCancelRemove,
  } = usePasswordless(user)

  const { accounts: accountsState } = useWalletData()
  const accounts = accountsState.data ?? []
  const linkedAccount = accounts.find((a) => a.isDefault) ?? accounts[0]

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <div className="flex items-center gap-3 px-4 py-3">
        <IconButton onClick={onClose} aria-label="Back">
          <Icon glyph="ArrowLeft" size={18} />
        </IconButton>
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
          <Card>
            <p className="text-sm font-semibold">{LINKED_PROVIDER}</p>
            <p className="mt-2 font-mono text-xs tracking-tight text-muted-foreground tabular-nums">
              {linkedAccount?.maskedIban ?? '••••'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {linkedAccount?.currency ?? 'EUR'} account
            </p>
          </Card>
        </div>

        <div>
          <SectionLabel icon={<Ico.FaceId size={14} />}>Passwordless login</SectionLabel>
          <Card>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Face ID on this device</p>
                <p className={cn('mt-0.5 text-xs', errorMsg ? 'text-destructive' : 'text-muted-foreground')}>
                  {statusText}
                </p>
              </div>
              <Toggle
                checked={isEnabled}
                onChange={handleToggle}
                label="Enable passwordless login"
                disabled={isBusy}
              />
            </div>
          </Card>
        </div>

        <button
          onClick={onSignOut}
          className="h-14 w-full rounded-full border border-border bg-card text-sm font-semibold text-destructive shadow-sm"
        >
          Sign out
        </button>
      </div>

      {isRemoveOpen && (
        <ConfirmDialog
          title="Remove Face ID?"
          message="This turns off passwordless login on this device. You'll use the full login next time."
          confirmLabel="Remove"
          onCancel={handleCancelRemove}
          onConfirm={handleConfirmRemove}
        />
      )}
    </div>
  )
}
