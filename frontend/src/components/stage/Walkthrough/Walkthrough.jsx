'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WALKTHROUGH } from '@/lib/walkthrough'

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
 * @param {object} props
 * @param {string} props.flow - Key into WALKTHROUGH for the active wallet screen.
 */
export function Walkthrough({ flow }) {
  const { steps } = WALKTHROUGH[flow]
  const [step, setStep] = useState(0)
  const count = steps.length

  useEffect(() => setStep(0), [flow])

  useEffect(() => {
    if (count < 2) return
    const id = setInterval(() => setStep((s) => (s + 1) % count), AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [count])

  const current = steps[Math.min(step, count - 1)]
  const Media = current.icon
  const Visual = current.visual
  const go = (delta) => setStep((s) => (s + delta + count) % count)

  return (
    <>
      <div className="min-h-[132px] overflow-hidden">
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
          {current.title}
        </h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          <Body text={current.body} highlight={current.highlight} />
        </p>
      </div>

      {/* Illustration area: a step's own visual when it has one, its icon otherwise. */}
      <div className="mt-4 grid h-48 place-items-center overflow-hidden rounded-2xl bg-secondary/[0.06]">
        {Visual ? (
          <Visual />
        ) : (
          Media && <Media className="size-10 text-secondary" strokeWidth={1.5} />
        )}
      </div>

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
                  onClick={() => setStep(i)}
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
