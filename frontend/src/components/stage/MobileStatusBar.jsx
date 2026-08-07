'use client'

import { useEffect, useRef, useState } from 'react'
import { Plane, Wifi } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Brand green from the desktop ConnectionControl's switch, the app's "this is on" colour.
const ON_GREEN = 'oklch(0.8254 0.2367 148.3680)'
const OFF_PILL = 'rgba(0,30,43,0.06)'
const FOREGROUND = '#001e2b'
const MUTED_FOREGROUND = 'rgba(0,30,43,0.55)'
// How long the label stays out after a tap, before the control collapses back to the bare glyph.
const LABEL_MS = 1800

/**
 * Fake device status bar for the /mobile route: the wifi indicator and the airplane-mode switch,
 * tucked into the right corner. Framed as airplane mode, not as a generic connection toggle, because
 * that is the one control everybody already knows means "cut this device off" - on the desktop stage
 * the equivalent is the labelled off-phone ConnectionControl.
 *
 * Deliberately small and icon-only: on a notch/Dynamic Island handset the middle of this strip is
 * spoken for, and a wide labelled pill up here reads as app chrome rather than device chrome. The
 * label is not gone, just deferred - it expands out of the glyph for a moment after each tap, which
 * is when it is actually worth reading. The wifi glyph is pure indicator; the plane is the control.
 * @param {object} props
 * @param {boolean} props.isOnline - Whether the simulated connection is up.
 * @param {() => void} props.onToggle
 * @param {boolean} [props.shouldNudge] - Pulse the switch on offline-relevant screens, the touch
 *   equivalent of the desktop control's "good moment to go offline" tooltip.
 */
export function MobileStatusBar({ isOnline, onToggle, shouldNudge = false }) {
  const prefersReduced = useReducedMotion()
  const [isLabelOut, setIsLabelOut] = useState(false)
  const labelTimer = useRef(undefined)

  useEffect(() => () => clearTimeout(labelTimer.current), [])

  function handleClick() {
    onToggle()
    setIsLabelOut(true)
    clearTimeout(labelTimer.current)
    labelTimer.current = setTimeout(() => setIsLabelOut(false), LABEL_MS)
  }

  const spring = prefersReduced
    ? { duration: 0 }
    : { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }

  return (
    <div className="relative z-40 flex flex-none items-center justify-end gap-2 border-b border-foreground/[0.07] bg-background/85 px-4 pt-[max(env(safe-area-inset-top),8px)] pb-2 backdrop-blur-xl">
      {/* Indicator only. Leaves upward when the plane takes over, so the two never read as two
          competing buttons. */}
      <AnimatePresence initial={false}>
        {isOnline && (
          <motion.span
            key="wifi"
            initial={{ opacity: 0, y: -6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.8 }}
            transition={spring}
            aria-hidden="true"
          >
            <Wifi className="size-[15px] text-foreground/45" />
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleClick}
        role="switch"
        aria-checked={!isOnline}
        aria-label="Airplane mode"
        whileTap={prefersReduced ? undefined : { scale: 0.92 }}
        animate={{
          backgroundColor: isOnline ? OFF_PILL : ON_GREEN,
          color: isOnline ? MUTED_FOREGROUND : FOREGROUND,
        }}
        transition={spring}
        // -my-2/py-2 keeps a thumb-sized hit area without making the bar taller.
        className="relative -my-2 flex items-center gap-1 rounded-full py-2 pl-[7px] pr-[7px] text-[11px] font-semibold tracking-wide"
      >
        {/* Ring pulse on screens the walkthrough marks as an offline moment. */}
        {shouldNudge && isOnline && !prefersReduced && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0.45, scale: 1 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: ON_GREEN }}
          />
        )}

        {/* Banks and climbs on the way into airplane mode, levels off on the way out. */}
        <motion.span
          animate={prefersReduced ? {} : { rotate: isOnline ? 0 : -12, y: isOnline ? 0 : -0.5 }}
          transition={spring}
          className="relative"
        >
          <Plane className="size-[15px]" aria-hidden="true" />
        </motion.span>

        {/* Says what just happened, then gets out of the way. Width-animated so the glyph stays put
            in the corner and only the pill grows leftward. */}
        <AnimatePresence initial={false}>
          {isLabelOut && (
            <motion.span
              key="label"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={spring}
              className="relative overflow-hidden whitespace-nowrap"
            >
              <span className="pl-0.5 pr-1">{isOnline ? 'Airplane mode off' : 'Airplane mode'}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
