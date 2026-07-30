'use client'

import Icon from '@leafygreen-ui/icon'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { ProfileMenu } from '@/components/wallet/shell/ProfileMenu/ProfileMenu'

const MAX_BADGE = 9

/**
 * The Home screen's gradient hero: an avatar/name pill and a notifications bell over a green wash, with
 * a "welcome back" greeting.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onSignOut
 * @param {() => void} [props.onProfile] - Opens the Profile screen.
 * @param {() => void} [props.onOpenNotifications] - Opens the notifications panel.
 */
export function HomeHero({ user, onSignOut, onProfile, onOpenNotifications }) {
  const { unreadCount } = useWalletData()
  const firstName = user.name.split(' ')[0]

  return (
    <div className="relative px-4 pt-12 pb-2 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-white/15 py-1 pr-4 pl-1 backdrop-blur-sm">
          <ProfileMenu user={user} onLogout={onSignOut} onProfile={onProfile} size={30} />
          <span className="text-sm font-medium tracking-tight">{user.name}</span>
        </div>
        <button
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <Icon glyph="Bell" size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-7">
        <p className="text-2xl font-medium leading-tight tracking-tight">Hi {firstName}</p>
        <p className="text-2xl font-normal leading-tight tracking-tight text-white/70">welcome back</p>
      </div>
    </div>
  )
}
