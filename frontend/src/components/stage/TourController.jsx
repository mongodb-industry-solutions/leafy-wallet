'use client'

import { Pause, Play, X } from 'lucide-react'

/**
 * On-stage controls for the self-driving tour: one continuous progress bar that fills as the tour
 * advances through its actions, plus pause/resume and exit. There is deliberately no skip - the
 * cursor performs each real interaction, so jumping ahead would desync the pointer from the UI.
 * The narration lives in the panel.
 * @param {object} props
 * @param {number} props.index - Zero-based index of the active action.
 * @param {number} props.total - Total actions.
 * @param {boolean} props.isPaused
 * @param {() => void} props.onTogglePause
 * @param {() => void} props.onExit
 */
export function TourController({ index, total, isPaused, onTogglePause, onExit }) {
  const pct = Math.round(((index + 1) / total) * 100)

  return (
    <div className="flex items-center gap-3 rounded-full border border-border bg-card/95 px-3 py-2 shadow-[0_12px_40px_-12px_rgba(0,30,43,0.4)] backdrop-blur">
      <button
        type="button"
        aria-label={isPaused ? 'Resume tour' : 'Pause tour'}
        onClick={onTogglePause}
        className="grid size-8 place-items-center rounded-full bg-foreground/[0.06] text-foreground transition-colors hover:bg-foreground/10"
      >
        {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>

      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-foreground/[0.08]">
        <span
          className="block h-full rounded-full bg-secondary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <button
        type="button"
        aria-label="Exit tour"
        onClick={onExit}
        className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
