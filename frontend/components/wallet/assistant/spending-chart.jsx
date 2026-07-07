'use client'

import { useEffect, useState } from 'react'

/** Weekly spending breakdown the assistant renders inline — animated bars that
 *  grow on mount, ranked by amount. */
export function SpendingChart({ data }) {
  const [grown, setGrown] = useState(false)
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(...data.map((d) => d.value))
  const rows = [...data].sort((a, b) => b.value - a.value)

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="w-64 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          This week
        </p>
        <p className="text-lg font-bold tabular-nums">€{total}</p>
      </div>

      <div className="mt-3.5 flex flex-col gap-3">
        {rows.map((d) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{d.label}</span>
              <span className="tabular-nums text-muted-foreground">
                €{d.value} · {Math.round((d.value / total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: grown ? `${(d.value / max) * 100}%` : '0%', background: d.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
