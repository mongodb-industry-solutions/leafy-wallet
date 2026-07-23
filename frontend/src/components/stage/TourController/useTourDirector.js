'use client'

import { useCallback, useEffect, useState } from 'react'
import { TOUR } from '@/lib/tour'

// Fallback hold if an action omits readMs.
const DEFAULT_READ_MS = 1000

/**
 * Sequences the cursor-driven tour: publishes the current action for the cursor to perform, and once
 * the cursor reports it done, holds for the action's `readMs` (so the narration can be read) before
 * advancing. Pause freezes between actions; skip jumps to the next; exhausting the list calls
 * `onFinish`. The cursor itself performs the real DOM interaction - this hook only owns sequencing.
 * @param {object} props
 * @param {boolean} props.isActive
 * @param {() => void} props.onFinish
 * @returns {{
 *   command: import('@/lib/tour').TourAction | null,
 *   index: number,
 *   total: number,
 *   isPaused: boolean,
 *   onStepComplete: () => void,
 *   togglePause: () => void,
 *   skip: () => void,
 * }}
 */
export function useTourDirector({ isActive, onFinish }) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isStepDone, setIsStepDone] = useState(false)

  // Restart cleanly whenever the tour is (re)activated.
  useEffect(() => {
    if (isActive) {
      setIndex(0)
      setIsPaused(false)
      setIsStepDone(false)
    }
  }, [isActive])

  const advance = useCallback(() => {
    setIsStepDone(false)
    setIndex((i) => {
      if (i + 1 >= TOUR.length) {
        onFinish?.()
        return i
      }
      return i + 1
    })
  }, [onFinish])

  // Once the action is performed, hold for readMs (unless paused) then move on.
  useEffect(() => {
    if (!isActive || !isStepDone || isPaused) return undefined
    const readMs = TOUR[index]?.readMs ?? DEFAULT_READ_MS
    const id = setTimeout(advance, readMs)
    return () => clearTimeout(id)
  }, [isActive, isStepDone, isPaused, index, advance])

  const onStepComplete = useCallback(() => setIsStepDone(true), [])
  const togglePause = useCallback(() => setIsPaused((p) => !p), [])
  const skip = useCallback(() => advance(), [advance])

  return {
    command: isActive ? TOUR[index] : null,
    index,
    total: TOUR.length,
    isPaused,
    onStepComplete,
    togglePause,
    skip,
  }
}
