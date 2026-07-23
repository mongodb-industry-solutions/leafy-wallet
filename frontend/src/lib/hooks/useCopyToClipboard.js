'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// How long the "copied" confirmation stays up before reverting to the copy icon.
const COPIED_RESET_MS = 1800

/**
 * Copies text to the clipboard and exposes a short-lived `isCopied` flag for confirmation UI.
 * @returns {{ isCopied: boolean, copy: (text: string) => Promise<void> }}
 */
export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const copy = useCallback(async (text) => {
    await navigator.clipboard.writeText(text)
    setIsCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_RESET_MS)
  }, [])

  return { isCopied, copy }
}
