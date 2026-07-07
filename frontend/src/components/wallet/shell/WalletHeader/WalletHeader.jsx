'use client'

import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'
import { ProfileMenu } from '@/components/wallet/shell/ProfileMenu/ProfileMenu'

/**
 * Top bar of the wallet app: the Leafy Wallet mark, the user's name, and the
 * profile menu.
 * @param {object} props
 * @param {{name: string, handle: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onSignOut
 */
export function WalletHeader({ user, onSignOut }) {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <LeafLogo size={22} color="green-dark-2" />
        <span className="text-sm font-bold tracking-tight text-foreground">{user.name}</span>
      </div>
      <ProfileMenu user={user} onLogout={onSignOut} size={38} align="end" />
    </header>
  )
}
