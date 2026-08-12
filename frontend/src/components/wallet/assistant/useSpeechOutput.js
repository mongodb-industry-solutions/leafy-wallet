'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Capability never changes after load, so it only needs a snapshot — and `false` while server-rendered. */
const subscribeToNothing = () => () => {}

const getSynth = () => (typeof window === 'undefined' ? null : (window.speechSynthesis ?? null))

// Chrome cuts a long utterance off mid-sentence, so replies are spoken as a queue of short ones.
const MAX_CHUNK_CHARS = 180

// The voices that read a payment confirmation without sounding like a screen reader, best first.
const PREFERRED_VOICES = ['Google UK English Female', 'Google US English', 'Samantha', 'Karen']

/** Emoji and symbols get read out as their names ("bar chart"), which derails an otherwise clean reply. */
const speakable = (text) =>
  text
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Break a reply on sentence ends, then on spaces, so no single utterance runs past the Chrome cutoff. */
function toChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > MAX_CHUNK_CHARS) {
      chunks.push(current.trim())
      current = ''
    }
    // A single sentence longer than the cap still has to be split, on the last space that fits.
    let rest = sentence
    while (rest.length > MAX_CHUNK_CHARS) {
      const cut = rest.lastIndexOf(' ', MAX_CHUNK_CHARS)
      const at = cut > 0 ? cut : MAX_CHUNK_CHARS
      chunks.push(rest.slice(0, at).trim())
      rest = rest.slice(at)
    }
    current += rest
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

/**
 * Reads assistant replies aloud through the browser's speech synthesis, so a chat opened by voice can
 * be answered by voice. Speaking is barge-in safe: any new {@link speak} or {@link cancel} drops what
 * is still queued.
 * @returns {{isSupported: boolean, isSpeaking: boolean, speak: (text: string) => void, cancel: () => void}}
 */
export function useSpeechOutput() {
  const isSupported = useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(getSynth()),
    () => false,
  )
  const [isSpeaking, setIsSpeaking] = useState(false)
  const voiceRef = useRef(null)

  // Voices load asynchronously in Chrome, so the list is read again when it arrives.
  useEffect(() => {
    const synth = getSynth()
    if (!synth) return
    const choose = () => {
      const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
      voiceRef.current =
        PREFERRED_VOICES.map((name) => voices.find((v) => v.name === name)).find(Boolean) ??
        voices.find((v) => v.default) ??
        voices[0] ??
        null
    }
    choose()
    synth.addEventListener('voiceschanged', choose)
    return () => synth.removeEventListener('voiceschanged', choose)
  }, [])

  // A reply still being read when the tab unmounts would keep talking over the rest of the app.
  useEffect(() => () => getSynth()?.cancel(), [])

  const cancel = useCallback(() => {
    getSynth()?.cancel()
    setIsSpeaking(false)
  }, [])

  const speak = useCallback(
    (text) => {
      const synth = getSynth()
      if (!synth) return
      const chunks = toChunks(speakable(text ?? ''))
      synth.cancel()
      if (chunks.length === 0) {
        setIsSpeaking(false)
        return
      }
      setIsSpeaking(true)
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        if (voiceRef.current) utterance.voice = voiceRef.current
        utterance.rate = 1.05
        // Only the tail of the queue settles the state; `cancel` fires `onend` on the rest.
        if (index === chunks.length - 1) {
          utterance.onend = () => setIsSpeaking(false)
          utterance.onerror = () => setIsSpeaking(false)
        }
        synth.speak(utterance)
      })
    },
    [],
  )

  return { isSupported, isSpeaking, speak, cancel }
}
