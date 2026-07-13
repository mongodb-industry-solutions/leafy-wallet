'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { APP_USERS, SPENDING_DATA, findContact, parseIntent } from '@/lib/wallet-data'
import { useSpeech } from './useSpeech'

const DECLINE_RE = /^\s*(no|nope|nah|skip|no note|no thanks)\b/i
const NEW_CHAT_TITLE = 'New chat'

let seq = 1
const nextId = () => `msg-${Date.now()}-${seq++}`

// `stream: true` marks a live reply so the UI typewrites it. Seeded/history
// messages omit it and render in full.
function txt(text) {
  return { id: nextId(), role: 'assistant', type: 'text', text, stream: true }
}

function draftMessages(intent, note) {
  const contact = findContact(intent.name)
  return [
    txt("Here's your draft. Review it before it goes."),
    {
      id: nextId(),
      role: 'assistant',
      type: 'action',
      actionData: { contact, amount: intent.amount, note, mode: intent.type, isConfirmed: false },
    },
  ]
}

// Seeded past conversations for the history view (no backend). Static ids so
// server and client markup match.
const MOCK_CHATS = [
  {
    id: 'm1',
    title: 'Splitting dinner with Maria',
    messages: [
      { id: 'm1-1', role: 'user', type: 'text', text: 'Split the dinner bill with Maria' },
      { id: 'm1-2', role: 'assistant', type: 'text', text: "I split €40 evenly, so that's €20 each. Want me to send Maria her half?" },
    ],
  },
  {
    id: 'm2',
    title: 'My spending this week',
    messages: [
      { id: 'm2-1', role: 'user', type: 'text', text: 'How much did I spend this week?' },
      { id: 'm2-2', role: 'assistant', type: 'text', text: 'You spent €176 this week, mostly on food and fun.' },
    ],
  },
  {
    id: 'm3',
    title: 'Request from Jordan',
    messages: [
      { id: 'm3-1', role: 'user', type: 'text', text: 'Request €50 from Jordan' },
      { id: 'm3-2', role: 'assistant', type: 'text', text: "Sent Jordan a request for €50. I'll let you know when it's paid." },
    ],
  },
]

/**
 * Derives a short chat title from the first user message (cleaned + truncated).
 * @param {string} text
 * @returns {string}
 */
function deriveTitle(text) {
  const clean = text.trim().replace(/[.?!,]+$/g, '')
  const words = clean.split(/\s+/).slice(0, 5).join(' ')
  return words.length > 30 ? `${words.slice(0, 30).trim()}…` : words
}

/**
 * Chat state machine for the AI assistant tab (conversations, greeting state, voice/text input, intent resolution, auto-renaming).
 * @returns {object} Chat state and actions for AiTab to render.
 */
export function useAiChat() {
  const [user] = useState(APP_USERS[0])
  const [chats, setChats] = useState(() => [{ id: 'chat-1', title: NEW_CHAT_TITLE, messages: [] }, ...MOCK_CHATS])
  const [activeId, setActiveId] = useState('chat-1')
  const [view, setView] = useState('chat') // 'chat' | 'history'
  const [textInput, setTextInput] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const endRef = useRef(null)
  const timeoutRef = useRef(null)
  // Holds a send/request intent that's waiting on the user's note answer.
  const pendingRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const active = chats.find((c) => c.id === activeId) ?? chats[0]
  const msgs = active.messages
  const title = active.title
  const isEmpty = msgs.length === 0

  const patchActive = useCallback(
    (fn) => setChats((prev) => prev.map((c) => (c.id === activeId ? fn(c) : c))),
    [activeId],
  )

  const handleProcessText = useCallback(
    (text) => {
      // Append the user message, auto-naming the chat off the first one.
      patchActive((c) => ({
        ...c,
        title: c.messages.length === 0 && c.title === NEW_CHAT_TITLE ? deriveTitle(text) : c.title,
        messages: [...c.messages, { id: nextId(), role: 'user', type: 'text', text }],
      }))
      setTranscript('')
      setIsThinking(true)
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setIsThinking(false)
        // Call resolve ONCE (it mutates pendingRef), never inside a state
        // updater, which React double-invokes in StrictMode.
        const replies = resolve(text)
        patchActive((c) => ({ ...c, messages: [...c.messages, ...replies] }))
      }, 3500)
    },
    [patchActive],
  )

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
      return [txt(`Sure, add a note to this ${verb}? Reply with a note, or say "no".`)]
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
    // The action card flips to its confirmed ("Sent"/"Requested") state, no
    // extra chat reply needed.
    patchActive((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === id ? { ...m, actionData: { ...m.actionData, isConfirmed: true } } : m,
      ),
    }))
  }

  function handleSendText() {
    const t = textInput.trim()
    if (!t) return
    setTextInput('')
    handleProcessText(t)
  }

  function handleSuggestion(query) {
    handleProcessText(query)
  }

  function resetTransient() {
    pendingRef.current = null
    clearTimeout(timeoutRef.current)
    setIsThinking(false)
    setTextInput('')
    setTranscript('')
  }

  function handleNewChat() {
    resetTransient()
    const chat = { id: nextId(), title: NEW_CHAT_TITLE, messages: [] }
    setChats((p) => [chat, ...p])
    setActiveId(chat.id)
    setView('chat')
  }

  function handleOpenChat(id) {
    resetTransient()
    setActiveId(id)
    setView('chat')
  }

  return {
    user,
    chats,
    activeId,
    view,
    setView,
    msgs,
    title,
    isEmpty,
    textInput,
    setTextInput,
    transcript,
    isThinking,
    isListening,
    handleStart,
    handleStop,
    endRef,
    hasText: textInput.trim().length > 0,
    handleScrollToEnd,
    handleConfirmAction,
    handleSendText,
    handleSuggestion,
    handleNewChat,
    handleOpenChat,
  }
}
