'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendChatMessage,
  createChat,
  createRequest,
  deleteChat,
  getChatMessages,
  getChats,
  sendMoney,
} from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { useSpeech } from './useSpeech'

const NEW_CHAT_TITLE = 'New chat'

let seq = 1
const nextId = () => `msg-${Date.now()}-${seq++}`

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
 * Streams one assistant turn. The route emits NDJSON so drafted payments and spending charts can
 * ride the same stream as the text - `onDraft`/`onChart` fire the moment one arrives, mid-stream.
 * @param {object} body - `{ message, history, isOnline }`.
 * @param {{onToken: (text: string) => void, onDraft: (draft: object) => void, onChart: (chart: object) => void}} handlers
 * @returns {Promise<string>} The full reply text.
 */
async function streamTurn(body, { onToken, onDraft, onChart }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw new Error(await res.text().catch(() => 'Chat failed'))

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type === 'token') {
        text += event.text
        onToken(text)
      } else if (event.type === 'draft') {
        onDraft(event.draft)
      } else if (event.type === 'chart') {
        onChart(event.chart)
      } else if (event.type === 'error') {
        throw new Error(event.text)
      }
    }
  }
  return text
}

/**
 * Chat state machine for the AI assistant tab: conversations, greeting state, voice/text input,
 * and the streamed reply. Chats and messages persist per user, from Atlas or the device depending
 * on the connection.
 * @returns {object} Chat state and actions for AiTab to render.
 */
export function useAiChat() {
  const { isOnline, refresh } = useWalletData()
  const [chats, setChats] = useState([{ id: 'draft', title: NEW_CHAT_TITLE, messages: [] }])
  const [activeId, setActiveId] = useState('draft')
  const [view, setView] = useState('chat') // 'chat' | 'history'
  const [textInput, setTextInput] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const endRef = useRef(null)
  const isOnlineRef = useRef(isOnline)
  isOnlineRef.current = isOnline

  const active = chats.find((c) => c.id === activeId) ?? chats[0]
  const msgs = active?.messages ?? []
  const title = active?.title ?? NEW_CHAT_TITLE
  const isEmpty = msgs.length === 0

  const patchActive = useCallback(
    (fn) => setChats((prev) => prev.map((c) => (c.id === activeId ? fn(c) : c))),
    [activeId],
  )

  // The saved chats list; the unsaved "draft" chat stays at the top until its first message.
  useEffect(() => {
    let isStale = false
    getChats(isOnline).then((saved) => {
      if (isStale) return
      setChats((prev) => {
        const draft = prev.find((c) => c.id === 'draft')
        const withMessages = new Map(prev.map((c) => [c.id, c.messages]))
        const rows = saved.map((c) => ({ ...c, messages: withMessages.get(c.id) ?? [] }))
        return draft ? [draft, ...rows] : rows
      })
    })
    return () => {
      isStale = true
    }
  }, [isOnline])

  const handleProcessText = useCallback(
    async (text) => {
      const history = msgs.filter((m) => m.type === 'text').map((m) => ({ role: m.role, text: m.text }))
      const userMessage = { id: nextId(), role: 'user', type: 'text', text }
      patchActive((c) => ({
        ...c,
        title: c.messages.length === 0 && c.title === NEW_CHAT_TITLE ? deriveTitle(text) : c.title,
        messages: [...c.messages, userMessage],
      }))
      setTranscript('')
      setIsThinking(true)

      // A chat only becomes real once it has something in it.
      let reference = activeId === 'draft' ? null : activeId
      if (!reference) {
        const created = await createChat(deriveTitle(text), isOnlineRef.current)
        if (created.ok) {
          reference = created.chat.reference
          setChats((prev) => [
            { id: 'draft', title: NEW_CHAT_TITLE, messages: [] },
            ...prev.map((c) =>
              c.id === 'draft' ? { ...c, id: reference, title: created.chat.title } : c,
            ),
          ])
          setActiveId(reference)
        }
      }
      if (reference) appendChatMessage(reference, { role: 'user', text }, isOnlineRef.current)

      const replyId = nextId()
      const threadId = () => reference ?? activeId
      const appendToThread = (message) => {
        setChats((prev) =>
          prev.map((c) => (c.id === threadId() ? { ...c, messages: [...c.messages, message] } : c)),
        )
      }
      try {
        const reply = await streamTurn(
          { message: text, history, isOnline: isOnlineRef.current },
          {
            onToken: (partial) => {
              setIsThinking(false)
              setChats((prev) =>
                prev.map((c) => {
                  if (c.id !== threadId()) return c
                  const withoutReply = c.messages.filter((m) => m.id !== replyId)
                  return {
                    ...c,
                    messages: [
                      ...withoutReply,
                      { id: replyId, role: 'assistant', type: 'text', text: partial, stream: 'live' },
                    ],
                  }
                }),
              )
            },
            // Cards render the moment a tool produces them, alongside the streaming reply.
            onDraft: (draft) =>
              appendToThread({
                id: nextId(),
                role: 'assistant',
                type: 'action',
                actionData: { ...draft, isConfirmed: false },
              }),
            onChart: (chart) =>
              appendToThread({
                id: nextId(),
                role: 'assistant',
                type: 'chart',
                chartTitle: chart.title,
                chartData: chart.rows,
              }),
          },
        )
        // Seal the reply: 'done' lets the typewriter finish and mark itself so it never replays.
        setChats((prev) =>
          prev.map((c) =>
            c.id === threadId()
              ? { ...c, messages: c.messages.map((m) => (m.id === replyId ? { ...m, stream: 'done' } : m)) }
              : c,
          ),
        )
        if (reference && reply) appendChatMessage(reference, { role: 'assistant', text: reply }, isOnlineRef.current)
      } catch (error) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === (reference ?? activeId)
              ? {
                  ...c,
                  messages: [
                    ...c.messages.filter((m) => m.id !== replyId),
                    { id: replyId, role: 'assistant', type: 'text', text: `I couldn't answer that: ${error.message}` },
                  ],
                }
              : c,
          ),
        )
      } finally {
        setIsThinking(false)
      }
    },
    [activeId, msgs, patchActive],
  )

  const { isListening, handleStart, handleStop } = useSpeech(handleProcessText, setTranscript)

  const handleScrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, isThinking, transcript])

  /** The card is the confirm step: nothing moved until the user tapped it. */
  async function handleConfirmAction(id) {
    const message = msgs.find((m) => m.id === id)
    const draft = message?.actionData
    if (!draft || draft.isConfirmed) return

    const result =
      draft.mode === 'request'
        ? await createRequest({
            counterpartyArrangementReference: draft.contact.reference,
            amount: draft.amount,
            note: draft.note,
            isOnline,
          })
        : await sendMoney({
            counterpartyArrangementReference: draft.contact.reference,
            amount: draft.amount,
            note: draft.note,
            isOnline,
          })

    if (!result.ok) {
      patchActive((c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: nextId(), role: 'assistant', type: 'text', text: result.error },
        ],
      }))
      return
    }
    patchActive((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === id ? { ...m, actionData: { ...m.actionData, isConfirmed: true } } : m,
      ),
    }))
    refresh(draft.mode === 'request' ? ['requests'] : ['accounts', 'transactions'])
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
    setIsThinking(false)
    setTextInput('')
    setTranscript('')
  }

  async function handleNewChat() {
    resetTransient()
    setChats((prev) =>
      prev.some((c) => c.id === 'draft')
        ? prev
        : [{ id: 'draft', title: NEW_CHAT_TITLE, messages: [] }, ...prev],
    )
    setActiveId('draft')
    setView('chat')
  }

  /** Removes a chat everywhere: the list (optimistically) and whichever store holds it. */
  function handleDeleteChat(id) {
    if (id === 'draft') return
    setChats((prev) => {
      const rest = prev.filter((c) => c.id !== id)
      return rest.some((c) => c.id === 'draft')
        ? rest
        : [{ id: 'draft', title: NEW_CHAT_TITLE, messages: [] }, ...rest]
    })
    if (activeId === id) {
      resetTransient()
      setActiveId('draft')
    }
    deleteChat(id, isOnlineRef.current)
  }

  async function handleOpenChat(id) {
    resetTransient()
    setActiveId(id)
    setView('chat')
    const messages = await getChatMessages(id, isOnlineRef.current)
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, messages } : c)))
  }

  return {
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
    handleDeleteChat,
  }
}
