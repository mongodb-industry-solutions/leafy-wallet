'use client'

import { useEffect, useState } from 'react'
import { DEMO_USERS } from '@/lib/demo-users'

const ROTATE_MS = 3200

/**
 * Walkthrough visual for the sign-in step: a mock login form showing exactly what to type,
 * cycling through the demo users (tap a name to pin one). The list lives in
 * `src/lib/demo-users.js`, the file to edit when running your own Leafy Pay.
 */
export function DemoUsersVisual() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % DEMO_USERS.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  const user = DEMO_USERS[index]

  function handlePickUser(i) {
    setIndex(i)
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2.5">
      <div className="flex gap-1.5">
        {DEMO_USERS.map((u, i) => (
          <button
            key={u.email}
            onClick={() => handlePickUser(i)}
            className={
              i === index
                ? 'rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-secondary-foreground'
                : 'rounded-full bg-foreground/[0.06] px-3 py-1 text-[10px] font-semibold text-muted-foreground'
            }
          >
            {u.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="w-64 rounded-2xl border border-border bg-white p-3.5 shadow-md">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </p>
        <div className="mt-1 flex h-8 items-center rounded-lg border border-border bg-muted px-2.5 text-[11px] font-semibold text-foreground">
          {user.email}
        </div>
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Password
        </p>
        <div className="mt-1 flex h-8 items-center rounded-lg border border-border bg-muted px-2.5 font-mono text-[11px] font-semibold text-foreground">
          {user.password}
        </div>
      </div>
    </div>
  )
}
