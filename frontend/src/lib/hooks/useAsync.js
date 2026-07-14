'use client'

import { useEffect, useState } from 'react'

/**
 * Runs an async action once on mount, tracking `{ data, error, isLoading }`. Ignores the result if the
 * component unmounts first.
 * @param {() => Promise<any>} action - A stable action reference (e.g. an imported Server Action).
 */
export function useAsync(action) {
  const [state, setState] = useState({ data: null, error: false, isLoading: true })

  useEffect(() => {
    let cancelled = false
    action()
      .then((data) => {
        if (!cancelled) setState({ data, error: false, isLoading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, error: true, isLoading: false })
      })
    return () => {
      cancelled = true
    }
    // Action is a stable module-level reference; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}
