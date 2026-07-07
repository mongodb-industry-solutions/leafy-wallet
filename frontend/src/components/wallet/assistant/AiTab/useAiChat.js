'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SPENDING_DATA, findContact, parseIntent } from '@/lib/wallet-data'
import { useSpeech } from './useSpeech'

const GREETING = {
  id: '0',
  role: 'assistant',
  type: 'text',
  text: 'Hey — ask me to send money, request from someone, or check your spending. Try "Send €20 to Maria for lunch".',
}

const DECLINE_RE = /^\s*(no|nope|nah|skip|no note|no thanks)\b/i

let seq = 1
const nextId = () => `${Date.now()}-${seq++}`

function txt(text) {
  return { id: nextId(), role: 'assistant', type: 'text', text }
}

function draftMessages(intent, note) {
  const contact = findContact(intent.name)
  return [
    txt("Here's your draft — review it before it goes."),
    {
      id: nextId(),
      role: 'assistant',
      type: 'action',
      actionData: { contact, amount: intent.amount, note, mode: intent.type, isConfirmed: false },
    },
  ]
}

/**
 * Chat state machine for the AI assistant tab: message history, voice/text
 * input, and intent resolution (send/request/spending queries). Kept
 * separate from AiTab so the component itself stays UI-only.
 * @returns {object} Chat state and actions for AiTab to render.
 */
export function useAiChat() {
  const [msgs, setMsgs] = useState([GREETING])
  const [textInput, setTextInput] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const endRef = useRef(null)
  const timeoutRef = useRef(null)
  // Holds a send/request intent that's waiting on the user's note answer.
  const pendingRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const handleProcessText = useCallback((text) => {
    setMsgs((p) => [...p, { id: nextId(), role: 'user', type: 'text', text }])
    setTranscript('')
    setIsThinking(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsThinking(false)
      // Call resolve ONCE (it mutates pendingRef); never inside a state updater,
      // which React double-invokes in StrictMode.
      const replies = resolve(text)
      setMsgs((p) => [...p, ...replies])
    }, 3500)
  }, [])

  // Turn the user's message into the assistant's reply(s).
  function resolve(text) {
    const intent = parseIntent(text)
    const isPayment = intent?.type === 'send' || intent?.type === 'request'

    // Awaiting a note, and the reply isn't itself a new command → it's the note.
    if (pendingRef.current && !isPayment) {
      const drafted = pendingRef.current
      pendingRef.current = null
      return draftMessages(drafted, DECLINE_RE.test(text) ? '' : text.trim())
    }
    pendingRef.current = null

    if (isPayment) {
      if (intent.note) return draftMessages(intent, intent.note)
      pendingRef.current = intent
      const verb = intent.type === 'request' ? 'request' : 'payment'
      return [txt(`Sure — add a note to this ${verb}? Reply with a note, or say "no".`)]
    }

    if (intent?.type === 'spending') {
      return [
        txt("Here's your spending this week:"),
        { id: nextId(), role: 'assistant', type: 'chart', chartData: SPENDING_DATA },
      ]
    }

    return [
      txt('I didn\'t catch that. Try "Send €30 to Taylor for lunch", "Request €15 from Sam", or "How much did I spend?"'),
    ]
  }

  const { isListening, handleStart, handleStop } = useSpeech(handleProcessText, setTranscript)

  const handleScrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, isThinking, transcript])

  function handleConfirmAction(id) {
    setMsgs((p) =>
      p.map((m) => (m.id === id ? { ...m, actionData: { ...m.actionData, isConfirmed: true } } : m)),
    )
    setTimeout(
      () =>
        setMsgs((p) => [
          ...p,
          { id: nextId(), role: 'assistant', type: 'text', text: 'Done! Anything else?' },
        ]),
      400,
    )
  }

  function handleSendText() {
    const t = textInput.trim()
    if (!t) return
    setTextInput('')
    handleProcessText(t)
  }

  const hasText = textInput.trim().length > 0

  return {
    msgs,
    textInput,
    setTextInput,
    transcript,
    isThinking,
    isListening,
    handleStart,
    handleStop,
    endRef,
    hasText,
    handleScrollToEnd,
    handleConfirmAction,
    handleSendText,
  }
}
