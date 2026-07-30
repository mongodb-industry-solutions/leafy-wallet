'use client'

import { useState } from 'react'
import { Peep } from '@/components/common/Peep/Peep'
import { Ico } from '@/components/common/Icons/Icons'

/**
 * Avatar button that opens a dropdown with the user's name/email, a link to
 * the Profile screen, and a sign-out action. The dropdown hugs the avatar's left edge.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onLogout
 * @param {() => void} [props.onProfile] - Opens the Profile screen.
 * @param {number} props.size - Avatar size in pixels.
 */
export function ProfileMenu({ user, onLogout, onProfile, size }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = () => {
    setIsOpen(false)
    onLogout()
  }

  const handleProfile = () => {
    setIsOpen(false)
    onProfile?.()
  }

  return (
    <div className="relative">
      <button className="flex rounded-full" onClick={() => setIsOpen((o) => !o)} aria-label="Profile menu">
        <Peep seed={user.seed} bg={user.bg} size={size} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 z-50 mt-2 min-w-44 rounded-2xl border border-border bg-card py-1 text-card-foreground shadow-[0_8px_32px_rgba(0,0,0,0.13)]">
            <div className="border-b border-border px-3.5 py-2.5">
              <p className="text-[13px] font-bold text-foreground">{user.name}</p>
              <p className="mt-px truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-foreground"
              onClick={handleProfile}
            >
              <Ico.User /> Profile
            </button>
            <button
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-destructive"
              onClick={handleSignOut}
            >
              <Ico.Logout /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
