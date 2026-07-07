'use client'

import { useCallback, useRef, useState } from 'react'
import { SAMPLE_QUERIES } from '@/lib/wallet-data'

/**
 * Voice input with graceful fallback: when the Web Speech API is unavailable
 * (most desktop browsers in the demo), it simulates a spoken sample query.
 */
export function useSpeech(onFinal, onInterim) {
  const [isListening, setIsListening] = useState(false)
  const recRef = useRef(null)
  const simRef = useRef(undefined)

  const handleStart = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setIsListening(true)
      let i = 0
      const sample = SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)]
      const tick = () => {
        i++
        onInterim?.(sample.slice(0, i * 3))
        if (i * 3 < sample.length) {
          simRef.current = setTimeout(tick, 60)
        } else {
          setIsListening(false)
          onFinal(sample)
        }
      }
      simRef.current = setTimeout(tick, 400)
      return
    }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      const t = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      onInterim?.(t)
      if (e.results[e.results.length - 1].isFinal) {
        setIsListening(false)
        onFinal(t)
      }
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recRef.current = rec
    rec.start()
    setIsListening(true)
  }, [onFinal, onInterim])

  const handleStop = useCallback(() => {
    clearTimeout(simRef.current)
    recRef.current?.stop()
    setIsListening(false)
  }, [])

  return { isListening, handleStart, handleStop }
}
