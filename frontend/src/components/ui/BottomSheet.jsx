'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

// Keyframes are defined in globals.css (sheet-slide-up/down, overlay-fade-in/out).
const ENTER = 'sheet-slide-up 320ms cubic-bezier(0.16, 1, 0.3, 1)'
const EXIT = 'sheet-slide-down 260ms cubic-bezier(0.4, 0, 1, 1) forwards'
const FADE_IN = 'overlay-fade-in 320ms ease'
const FADE_OUT = 'overlay-fade-out 260ms ease forwards'

/**
 * A bottom sheet: dimmed backdrop plus a card that slides up and back down on dismiss. CSS keyframes
 * drive the animation, and the panel's `animationend` drives focus-on-enter and unmount-on-exit.
 * `children` may be a function receiving `{ close }`, so content can dismiss the sheet itself. The
 * panel is height-capped: give a long child `min-h-0 overflow-y-auto` and it scrolls inside it.
 * @param {object} props
 * @param {() => void} props.onClose - Called once the exit animation finishes.
 * @param {() => void} [props.onEntered] - Called once the enter animation finishes (e.g. to focus a field).
 * @param {string} [props.className] - Extra classes for the panel.
 * @param {React.ReactNode | ((api: {close: () => void}) => React.ReactNode)} props.children
 */
export function BottomSheet({ onClose, onEntered, className, children }) {
  const [isClosing, setIsClosing] = useState(false)
  const close = useCallback(() => setIsClosing(true), [])

  function handleAnimationEnd(e) {
    if (e.target !== e.currentTarget) return
    if (isClosing) {
      onClose()
    } else {
      onEntered?.()
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/50"
        style={{ animation: isClosing ? FADE_OUT : FADE_IN }}
      />
      <div
        onAnimationEnd={handleAnimationEnd}
        className={cn(
          // % of the phone screen. vh would measure the browser window and overflow the frame.
          'relative flex max-h-[85%] flex-col rounded-t-3xl border-t border-border bg-card p-5 pb-8 text-foreground shadow-xl',
          className,
        )}
        style={{ animation: isClosing ? EXIT : ENTER }}
      >
        {typeof children === 'function' ? children({ close }) : children}
      </div>
    </div>
  )
}
