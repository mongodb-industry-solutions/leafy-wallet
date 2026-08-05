'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Long enough to read two lines of copy, short enough that it is gone before the presenter moves on.
const VISIBLE_MS = 7000

/**
 * Holds the one peer-device nudge the stage shows at a time. A new event replaces whatever is on screen
 * and restarts the timer, so a burst of settlements never stacks up or leaves a stale card behind.
 * @returns {{event: object|null, showEvent: (event: object) => void}}
 */
export function usePeerPhone() {
  const [event, setEvent] = useState(null)
  const timerRef = useRef(null)

  const showEvent = useCallback((next) => {
    clearTimeout(timerRef.current)
    setEvent(next)
    timerRef.current = setTimeout(() => setEvent(null), VISIBLE_MS)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { event, showEvent }
}
