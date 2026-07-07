'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FramePanel } from '@/components/ui/frame'
import { WALKTHROUGH } from '@/lib/walkthrough'

const AUTO_ADVANCE_MS = 6000

export function Walkthrough({ flow }) {
  const { steps } = WALKTHROUGH[flow] ?? WALKTHROUGH.home
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
  const go = (delta) => setStep((s) => (s + delta + count) % count)

  return (
    <FramePanel className="p-6">
      <div className="h-[176px] overflow-hidden">
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
          {current.title}
        </h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          {current.body}
        </p>
      </div>

      {/* Illustration area — icon placeholder for a future image/animation. */}
      <div className="grid h-32 place-items-center rounded-xl bg-gradient-to-br from-muted/70 to-muted/30">
        {Media && <Media className="size-9 text-foreground/70" strokeWidth={1.5} />}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2.5">
        <button
          aria-label="Previous step"
          onClick={() => go(-1)}
          disabled={count < 2}
          className="grid size-8 place-items-center rounded-full bg-muted-foreground text-background transition disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex h-8 items-center gap-2 rounded-full bg-muted-foreground px-3">
          {steps.map((_, i) =>
            i === step ? (
              <span key={i} className="h-1.5 w-6 overflow-hidden rounded-full bg-background/30">
                <span
                  key={step}
                  className="block h-full rounded-full bg-background"
                  style={
                    count > 1
                      ? { animation: `dot-fill ${AUTO_ADVANCE_MS}ms linear forwards` }
                      : { width: '100%' }
                  }
                />
              </span>
            ) : (
              <span key={i} className="size-1.5 rounded-full bg-background/60" />
            ),
          )}
        </div>

        <button
          aria-label="Next step"
          onClick={() => go(1)}
          disabled={count < 2}
          className="grid size-8 place-items-center rounded-full bg-muted-foreground text-background transition disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </FramePanel>
  )
}
