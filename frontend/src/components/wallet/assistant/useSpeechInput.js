'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Capability never changes after load, so it only needs a snapshot — and `false` while server-rendered. */
const subscribeToNothing = () => () => {}

/** Chrome and Safari still ship the recognizer prefixed. */
function getRecognizer() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Dictation for the chat composer, on the browser's built-in speech recognition. One utterance per
 * press: the recognizer stops itself when the speaker pauses, and the finished phrase is handed over
 * whole so it can be sent like any typed message.
 * @param {object} props
 * @param {(text: string) => void} props.onTranscript - Called once with the final utterance.
 * @returns {{isSupported: boolean, isListening: boolean, interim: string, error: string|null, toggle: () => void, stop: () => void}}
 */
export function useSpeechInput({ onTranscript }) {
  const isSupported = useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(getRecognizer()),
    () => false,
  )
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  // Mirrored so the handlers, bound once on mount, always reach the current callback.
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    const Recognizer = getRecognizer()
    if (!Recognizer) return
    const recognition = new Recognizer()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setError(null)
      setIsListening(true)
    }
    recognition.onresult = (event) => {
      let final = ''
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript
        else partial += result[0].transcript
      }
      const text = final.trim()
      setInterim(text ? '' : partial)
      if (text) onTranscriptRef.current?.(text)
    }
    recognition.onerror = (event) => {
      // `aborted` is our own stop and `no-speech` is a silent press: neither is worth surfacing.
      if (event.error !== 'aborted' && event.error !== 'no-speech') setError(event.error)
    }
    recognition.onend = () => {
      setIsListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onstart = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [])

  const stop = useCallback(() => recognitionRef.current?.stop(), [])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
      return
    }
    try {
      recognition.start()
    } catch {
      // Already starting; the pending onstart/onend pair still settles the state.
    }
  }, [isListening])

  return { isSupported, isListening, interim, error, toggle, stop }
}
