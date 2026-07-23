'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { WALKTHROUGH } from '@/lib/walkthrough'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

const AUTO_ADVANCE_MS = 10000

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
 * "Under the hood" panel: cycles through the talking points for the given wallet
 * screen, auto-advancing every {@link AUTO_ADVANCE_MS} and resetting whenever the
 * active screen (`flow`) changes. Steps are switched by tapping the dots.
 *
 * When the self-driving tour is running it passes a controlled `controlledStep`, which pins the
 * displayed step and suspends the self-advance timer so the panel stays in lock-step with the tour.
 * @param {object} props
 * @param {string} props.flow - Key into WALKTHROUGH for the active wallet screen.
 * @param {number} [props.controlledStep] - Tour-driven step index; when set, overrides self-advance.
 */
export function Walkthrough({ flow, controlledStep }) {
  const { steps } = WALKTHROUGH[flow]
  const [autoStep, setAutoStep] = useState(0)
  const count = steps.length
  const isControlled = controlledStep != null
  const step = isControlled ? Math.min(controlledStep, count - 1) : autoStep

  useEffect(() => setAutoStep(0), [flow])

  useEffect(() => {
    if (isControlled || count < 2) return
    const id = setInterval(() => setAutoStep((s) => (s + 1) % count), AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [isControlled, count])

  const current = steps[Math.min(step, count - 1)]
  const Media = current.icon
  const Visual = current.visual
  const go = (delta) => setAutoStep((s) => (s + delta + count) % count)
  const { isCopied, copy } = useCopyToClipboard()

  // Crossfade the talking point on each change so tour-driven (and manual) step changes read as a
  // transition, not a hard swap. Reduced motion collapses it to an instant cut.
  const prefersReduced = useReducedMotion()
  const fade = prefersReduced
    ? { transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.3, ease: 'easeInOut' },
      }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${flow}-${step}`} {...fade}>
          <div className="min-h-[104px]">
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
          <div className="mt-4 grid h-48 place-items-center overflow-hidden rounded-2xl bg-secondary/[0.06]">
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
            onClick={() => go(-1)}
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
                  onClick={() => setAutoStep(i)}
                  className="size-1.5 rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/70"
                />
              ),
            )}
          </div>

          <button
            aria-label="Next step"
            onClick={() => go(1)}
            className="grid size-8 place-items-center rounded-full bg-foreground/[0.06] text-foreground transition hover:bg-foreground/10"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </>
  )
}
