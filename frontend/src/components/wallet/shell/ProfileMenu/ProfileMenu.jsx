'use client'

import { useState } from 'react'
import { Peep } from '@/components/common/Peep/Peep'
import { Ico } from '@/components/common/Icons/Icons'
import { cn } from '@/lib/utils'

/**
 * Avatar button that opens a dropdown with the user's name/handle and a
 * sign-out action.
 * @param {object} props
 * @param {{name: string, handle: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onLogout
 * @param {number} [props.size] - Avatar size in pixels.
 * @param {'end'|'start'} [props.align] - Which side the dropdown hugs.
 */
export function ProfileMenu({ user, onLogout, size = 34, align = 'end' }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = () => {
    setIsOpen(false)
    onLogout()
  }

  return (
    <div className="relative">
      <button className="flex rounded-full" onClick={() => setIsOpen((o) => !o)} aria-label="Profile menu">
        <Peep seed={user.seed} bg={user.bg} size={size} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className={cn(
              'absolute top-full z-50 mt-2 min-w-44 rounded-2xl border border-border bg-card py-1 text-card-foreground shadow-[0_8px_32px_rgba(0,0,0,0.13)]',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            <div className="border-b border-border px-3.5 py-2.5">
              <p className="text-[13px] font-bold text-foreground">{user.name}</p>
              <p className="mt-px text-xs text-muted-foreground">{user.handle}</p>
            </div>
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
