'use client'

import { useEffect, useRef, useState } from 'react'
import { Pointer } from '@/components/common/Pointer'

const MOVE_MS = 700 // pointer travel time between targets
const TYPE_MS = 55 // per-character typing cadence
const PRESS_MS = 180 // how long the pointer stays "pressed" on a click
const CLICK_SETTLE_MS = 250 // pause after a click before the step is considered done
const SCROLL_MS = 700 // wait for a smooth scroll to finish
const RESOLVE_TRIES = 45 // poll ~5s for a target that appears after a screen transition
const RESOLVE_INTERVAL_MS = 120
const WAITFOR_TIMEOUT_MS = 12000 // cap on waiting for an external signal (e.g. settlement)
const WAITFOR_INTERVAL_MS = 200
const SETTLE_HOLD_MS = 1200 // linger after the signal fires so the outcome (and its bubble) reads

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const MOVE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Sets a React-controlled input/textarea value the way a real keypress would, so the component's
 * onChange fires (React tracks the native value, so we must go through its own setter).
 */
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * The simulated pointer that drives the tour. Given the director's current `command`, it moves to the
 * target and performs the real interaction - clicks the actual button, types into the actual input, or
 * scrolls the actual container - narrating each step in a speech bubble beside it, then reports back via
 * `onStepComplete`. A command may `waitFor` an external signal (e.g. the payment settling) before it
 * finishes. Lives at stage scope so it can travel off the phone to the connection toggle; nothing
 * between it and its targets is scaled, so plain rect math holds.
 * @param {object} props
 * @param {import('@/lib/tour').TourAction | null} props.command - The action to perform, or null when idle.
 * @param {() => void} props.onStepComplete - Called once the action (and any waitFor) is done.
 */
export function TourCursor({ command, onStepComplete }) {
  const rootRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [isPressing, setIsPressing] = useState(false)
  const [clickKey, setClickKey] = useState(0)
  const [bubble, setBubble] = useState(null)

  useEffect(() => {
    if (!command) return undefined
    let cancelled = false

    // An `optional` action is a "if this screen is open, get out of it" step: it must not spend the
    // full resolve budget waiting for an element that is legitimately absent, so it looks exactly once.
    const resolve = async (target) => {
      const tries = command.optional ? 1 : RESOLVE_TRIES
      for (let i = 0; i < tries; i += 1) {
        const el = document.querySelector(`[data-tour-target="${target}"]`)
        if (el) return el
        await delay(RESOLVE_INTERVAL_MS)
        if (cancelled) return null
      }
      return null
    }

    const pollSignal = async (signal) => {
      const start = Date.now()
      while (Date.now() - start < WAITFOR_TIMEOUT_MS) {
        if (document.querySelector(`[data-tour-signal="${signal}"]`)) return
        await delay(WAITFOR_INTERVAL_MS)
        if (cancelled) return
      }
    }

    const finish = async () => {
      if (command.waitFor) {
        await pollSignal(command.waitFor)
        if (cancelled) return
        if (command.sayDone) setBubble(command.sayDone)
        await delay(SETTLE_HOLD_MS)
        if (cancelled) return
      }
      onStepComplete()
    }

    const run = async () => {
      // An action without its own line keeps the previous one's bubble up.
      if (command.say) setBubble(command.say)
      const el = await resolve(command.target)
      if (cancelled) return
      if (!el) {
        await finish()
        return
      }

      const root = rootRef.current
      const r = el.getBoundingClientRect()
      const b = root.getBoundingClientRect()
      setPos({ x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top })
      await delay(MOVE_MS)
      if (cancelled) return

      if (command.type === 'click') {
        setClickKey((k) => k + 1)
        setIsPressing(true)
        ;(el.closest('button') || el).click()
        await delay(PRESS_MS)
        setIsPressing(false)
        await delay(CLICK_SETTLE_MS)
      } else if (command.type === 'type') {
        el.focus()
        const text = command.text ?? ''
        for (let i = 1; i <= text.length; i += 1) {
          if (cancelled) return
          setNativeValue(el, text.slice(0, i))
          await delay(TYPE_MS)
        }
      } else if (command.type === 'scroll') {
        el.scrollBy({ top: command.by ?? 0, behavior: 'smooth' })
        await delay(SCROLL_MS)
      }

      if (!cancelled) await finish()
    }

    run()
    return () => {
      cancelled = true
    }
  }, [command, onStepComplete])

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {pos && (
        <span
          className="absolute left-0 top-0 block"
          style={{ transform: `translate(${pos.x - 4}px, ${pos.y - 2}px)`, transition: `transform ${MOVE_MS}ms ${MOVE_EASE}` }}
        >
          <span
            className="block"
            style={{ transform: `scale(${isPressing ? 0.8 : 1})`, transition: 'transform 140ms ease-out' }}
          >
            <Pointer className="size-7 drop-shadow-md" />
          </span>
        </span>
      )}

      {pos && clickKey > 0 && (
        <span
          key={clickKey}
          className="absolute -ml-3.5 -mt-3.5 size-7 rounded-full border-2 border-secondary"
          style={{ left: pos.x, top: pos.y, animation: 'tour-click-ring 0.6s ease-out forwards' }}
        />
      )}

      {pos && bubble && (
        <div
          className="absolute max-w-[220px] rounded-2xl bg-foreground px-3.5 py-2 text-xs font-medium leading-snug text-background shadow-lg"
          style={{ left: pos.x + 18, top: pos.y + 14, transition: `left ${MOVE_MS}ms ${MOVE_EASE}, top ${MOVE_MS}ms ${MOVE_EASE}` }}
        >
          {bubble}
        </div>
      )}
    </div>
  )
}
