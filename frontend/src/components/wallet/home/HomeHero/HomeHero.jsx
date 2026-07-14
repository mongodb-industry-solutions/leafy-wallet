'use client'

import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'
import { ProfileMenu } from '@/components/wallet/shell/ProfileMenu/ProfileMenu'

/**
 * The Home screen's gradient hero: an avatar/name pill and Leafy mark over a green wash, with a "welcome back" greeting.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onSignOut
 * @param {() => void} [props.onProfile] - Opens the Profile screen.
 */
export function HomeHero({ user, onSignOut, onProfile }) {
  const firstName = user.name.split(' ')[0]

  return (
    <div className="relative px-4 pt-12 pb-2 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-white/15 py-1 pr-4 pl-1 backdrop-blur-sm">
          <ProfileMenu user={user} onLogout={onSignOut} onProfile={onProfile} size={30} align="start" />
          <span className="text-sm font-medium tracking-tight">{user.name}</span>
        </div>
        <LeafLogo size={38} color="white" />
      </div>

      <div className="mt-7">
        <p className="text-2xl font-medium leading-tight tracking-tight">Hi {firstName}</p>
        <p className="text-2xl font-normal leading-tight tracking-tight text-white/70">welcome back</p>
      </div>
    </div>
  )
}
