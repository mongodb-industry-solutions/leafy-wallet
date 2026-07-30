'use client'

import { useRef, useState } from 'react'

const SWIPE_REVEAL_PX = 88
const SWIPE_TRIGGER_PX = 44
const SWIPE_DEADZONE_PX = 6
// The drawer's feel: fast start, soft landing.
const SWIPE_EASE = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * A list row that swipes left to reveal a full-height action button, iOS-style. The button bleeds
 * to the container's edge - put the row in a wrapper with rounded corners + overflow-hidden and
 * the reveal clips natively. The parent keeps at most one row open via `isOpen`/`onOpenChange`.
 * Tapping the row fires `onTap` - unless it was a swipe, or the row is open (then it closes).
 * @param {object} props
 * @param {boolean} [props.canSwipe] - Disable to make the row a plain tappable row.
 * @param {boolean} props.isOpen - Whether this row is the revealed one; the parent enforces one.
 * @param {(isOpen: boolean) => void} props.onOpenChange
 * @param {() => void} [props.onTap] - Tap on the row surface (not the revealed action).
 * @param {string} props.actionLabel - Label of the revealed destructive button.
 * @param {() => void} props.onAction
 * @param {string} [props.rowClassName] - Extra classes for the sliding row surface.
 */
export function SwipeableRow({
  canSwipe = true,
  isOpen,
  onOpenChange,
  onTap,
  actionLabel,
  onAction,
  rowClassName = '',
  children,
}) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startOffset: 0, isPointerDown: false, didMove: false })

  // The parent owns the single open slot, so a row it closed renders shut whatever the last drag
  // left behind - and the next drag starts from there.
  const translateX = isOpen ? offset : 0

  function handlePointerDown(e) {
    if (!canSwipe) return
    dragRef.current = {
      startX: e.clientX,
      startOffset: translateX,
      isPointerDown: true,
      didMove: false,
    }
  }

  function handlePointerMove(e) {
    const drag = dragRef.current
    if (!drag.isPointerDown) return
    const dx = e.clientX - drag.startX
    if (!drag.didMove && Math.abs(dx) < SWIPE_DEADZONE_PX) return
    if (!drag.didMove) {
      drag.didMove = true
      setIsDragging(true)
      onOpenChange(true) // claim the single open slot so any other revealed row closes
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setOffset(Math.min(0, Math.max(-SWIPE_REVEAL_PX, drag.startOffset + dx)))
  }

  function handlePointerEnd() {
    const drag = dragRef.current
    if (!drag.isPointerDown) return
    drag.isPointerDown = false
    setIsDragging(false)
    const shouldStayOpen = translateX <= -SWIPE_TRIGGER_PX
    onOpenChange(shouldStayOpen)
    setOffset(shouldStayOpen ? -SWIPE_REVEAL_PX : 0)
  }

  function handleRowClick() {
    if (dragRef.current.didMove) return
    if (translateX !== 0) {
      onOpenChange(false)
      return
    }
    onTap?.()
  }

  function handleActionClick() {
    onOpenChange(false)
    onAction()
  }

  return (
    <div className="relative">
      {canSwipe && (
        <button
          onClick={handleActionClick}
          aria-label={actionLabel}
          tabIndex={isOpen ? 0 : -1}
          className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-destructive text-sm font-semibold text-destructive-foreground"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={handleRowClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`flex w-full touch-pan-y items-center text-left ${rowClassName}`}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : SWIPE_EASE,
        }}
      >
        {children}
      </button>
    </div>
  )
}
