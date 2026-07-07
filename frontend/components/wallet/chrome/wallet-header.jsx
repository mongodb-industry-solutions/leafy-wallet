'use client'

import { LeafLogo } from '@/components/common/leaf-logo'
import { ProfileMenu } from '@/components/wallet/chrome/profile-menu'

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
