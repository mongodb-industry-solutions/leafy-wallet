'use client'

import { useEffect, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'

// Keyframes are defined in globals.css (toast-drop-in/lift-out).
const ENTER = 'toast-drop-in 320ms cubic-bezier(0.16, 1, 0.3, 1)'
const EXIT = 'toast-lift-out 240ms cubic-bezier(0.4, 0, 1, 1) forwards'
const VISIBLE_MS = 4000

/**
 * A banner that drops in over the top of the phone screen and leaves on its own. Sits above the
 * content rather than in the layout, so nothing reflows when it appears.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} [props.glyph] - LeafyGreen icon glyph for the leading badge.
 * @param {'success'|'warning'} [props.tone]
 * @param {() => void} props.onDismiss - Called once the exit animation finishes.
 */
export function Toast({ title, subtitle, glyph = 'Checkmark', tone = 'success', onDismiss }) {
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setIsLeaving(true), VISIBLE_MS)
    return () => clearTimeout(id)
  }, [])

  function handleAnimationEnd(e) {
    if (e.target === e.currentTarget && isLeaving) onDismiss()
  }

  return (
    <div
      role="status"
      onAnimationEnd={handleAnimationEnd}
      style={{ animation: isLeaving ? EXIT : ENTER }}
      className="pointer-events-none absolute inset-x-3 top-3 z-[60] flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl"
    >
      <span
        className={cn(
          'grid size-9 flex-none place-items-center rounded-full',
          tone === 'success' ? 'bg-secondary/15 text-secondary' : 'bg-warning/15 text-warning',
        )}
      >
        <Icon glyph={glyph} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}
