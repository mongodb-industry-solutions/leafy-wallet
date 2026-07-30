'use client'

import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/wallet/format'

// Bars cycle through theme colors so the card follows the palette in globals.css.
const BAR_COLORS = ['var(--secondary)', 'var(--primary)', 'var(--warning)', 'var(--muted-foreground)']

/** A row's share of the total, as a whole percentage. Zero when there is nothing to divide. */
function percentOf(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

/** A bar's width relative to the largest row, guarding an all-zero dataset. */
function barWidth(value, max) {
  return max > 0 ? `${(value / max) * 100}%` : '0%'
}

/**
 * Spending breakdown the assistant renders inline, with animated bars ranked by amount.
 * @param {object} props
 * @param {{label: string, value: number, color?: string}[]} props.data - Bars; `color` optional.
 * @param {string} [props.title] - Card heading, e.g. "Sent by contact".
 */
export function SpendingChart({ data, title = 'This week' }) {
  const [isGrown, setIsGrown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (data.length === 0) return null

  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(...data.map((d) => d.value))
  const rows = [...data].sort((a, b) => b.value - a.value)

  return (
    <div className="w-64 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-lg font-bold tabular-nums">€{formatMoney(total)}</p>
      </div>

      <div className="mt-3.5 flex flex-col gap-3">
        {rows.map((d, i) => (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{d.label}</span>
              <span className="tabular-nums text-muted-foreground">
                €{formatMoney(d.value)} · {percentOf(d.value, total)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: isGrown ? barWidth(d.value, max) : '0%',
                  background: d.color ?? BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
