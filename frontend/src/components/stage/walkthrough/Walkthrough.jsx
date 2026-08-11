'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { WALKTHROUGH } from '@/lib/walkthrough'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

const AUTO_ADVANCE_MS = 10000
// Fixed (not just minimum) height for the talking point: steps differ by a line or two of title and
// body, and anything less pins the illustration to a different y on each step. Sized for the longest
// talking point, so the illustration sits at one position for every step and flow.
const TALKING_POINT_H = 'h-[168px]'

// Crossfade the talking point on each change so tour-driven (and manual) step changes read as a
// transition, not a hard swap. Reduced motion collapses it to an instant cut.
const FADE_MOTION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.3, ease: 'easeInOut' },
}
const FADE_NONE = { transition: { duration: 0 } }

/** Body text with one phrase picked out, for a value the presenter has to read off and type. */
function Body({ text, highlight }) {
  const [before, ...rest] = highlight ? text.split(highlight) : [text]
  if (!rest.length) return text
  return (
    <>
      {before}
      <span className="font-semibold text-foreground">{highlight}</span>
      {rest.join(highlight)}
    </>
  )
}

/**
 * "Under the hood" panel: cycles the talking points for the active wallet screen, auto-advancing every
 * {@link AUTO_ADVANCE_MS}. A tour-supplied `controlledStep` pins the step and suspends self-advance.
 * @param {object} props
 * @param {string} props.flow - Key into WALKTHROUGH for the active wallet screen.
 * @param {number} [props.controlledStep] - Tour-driven step index; when set, overrides self-advance.
 */
export function Walkthrough({ flow, controlledStep }) {
  const { steps } = WALKTHROUGH[flow]
  // The self-advance position is scoped to the flow it was reached on, so a flow change derives
  // back to step 0 instead of needing an effect to reset it.
  const [autoPosition, setAutoPosition] = useState({ flow, step: 0 })
  const count = steps.length
  const isControlled = controlledStep != null
  const autoStep = autoPosition.flow === flow ? autoPosition.step : 0
  const step = Math.min(isControlled ? controlledStep : autoStep, count - 1)

  // Schedule the next auto-advance relative to the current step. Keying on `autoStep` restarts the
  // timer whenever the step changes (including manual dot/arrow navigation), so moving mid-step gives
  // the next step a fresh full interval instead of inheriting the previous one's leftover time.
  useEffect(() => {
    if (isControlled || count < 2) return undefined
    const id = setTimeout(() => setAutoPosition({ flow, step: (autoStep + 1) % count }), AUTO_ADVANCE_MS)
    return () => clearTimeout(id)
  }, [isControlled, count, autoStep, flow])

  const current = steps[step]
  const Media = current.icon
  const Visual = current.visual
  const goTo = (next) => setAutoPosition({ flow, step: (next + count) % count })
  const { isCopied, copy } = useCopyToClipboard()

  const prefersReduced = useReducedMotion()
  const fade = prefersReduced ? FADE_NONE : FADE_MOTION

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${flow}-${step}`} {...fade}>
          <div className={TALKING_POINT_H}>
            <h3 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
              {current.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              <Body text={current.body} highlight={current.highlight} />
            </p>
          </div>

          {/* A step may surface a value to copy (e.g. the demo password) as a code box + copy button. */}
          {current.copyable && (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.04] px-3.5 py-2.5">
              <code className="flex-1 font-mono text-sm font-semibold text-foreground">{current.copyable}</code>
              <button
                type="button"
                onClick={() => copy(current.copyable)}
                aria-label={`Copy ${current.copyable}`}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-secondary/10"
              >
                {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {/* Illustration area: a step's own visual when it has one, its icon otherwise. */}
          <div className="mt-4 grid h-60 place-items-center overflow-hidden rounded-2xl bg-secondary/[0.06]">
            {Visual ? (
              <Visual />
            ) : (
              Media && <Media className="size-10 text-secondary" strokeWidth={1.5} />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* A lone step has nowhere to go, so the whole control would just be dead furniture. */}
      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <button
            aria-label="Previous step"
            onClick={() => goTo(step - 1)}
            className="grid size-8 place-items-center rounded-full bg-foreground/[0.06] text-foreground transition hover:bg-foreground/10"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="flex h-8 items-center gap-2 rounded-full bg-foreground/[0.06] px-3">
            {steps.map((s, i) =>
              i === step ? (
                <span key={s.title} className="h-1.5 w-6 overflow-hidden rounded-full bg-secondary/25">
                  <span
                    key={step}
                    className="block h-full rounded-full bg-secondary"
                    style={{ animation: `dot-fill ${AUTO_ADVANCE_MS}ms linear forwards` }}
                  />
                </span>
              ) : (
                <button
                  key={s.title}
                  aria-label={`Step ${i + 1}`}
                  onClick={() => goTo(i)}
                  className="size-1.5 rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/70"
                />
              ),
            )}
          </div>

          <button
            aria-label="Next step"
            onClick={() => goTo(step + 1)}
            className="grid size-8 place-items-center rounded-full bg-foreground/[0.06] text-foreground transition hover:bg-foreground/10"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </>
  )
}
