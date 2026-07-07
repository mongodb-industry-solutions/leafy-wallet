'use client'

import { useState } from 'react'
import { Peep } from '@/components/common/peep'
import { Ico } from '@/components/common/icons'
import { cn } from '@/lib/utils'

export function ProfileMenu({ user, onLogout, size = 34, align = 'end' }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button className="flex rounded-full" onClick={() => setOpen((o) => !o)} aria-label="Profile menu">
        <Peep seed={user.seed} bg={user.bg} size={size} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
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
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              <Ico.Logout /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
