'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendChatCard,
  appendChatMessage,
  createChat,
  createRequest,
  deleteChat,
  getChatMessages,
  getChats,
  sendMoney,
} from '@/lib/wallet/actions'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'

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
 * Runs one assistant turn and returns the whole result at once: `{ reply, drafts, charts }`. The
 * route waits for the full turn rather than streaming tokens - on a slow local model the token
 * trickle stutters the typewriter, so the client reveals the finished reply at a steady rate.
 * @param {object} body - `{ message, history, isOnline }`.
 * @returns {Promise<{reply: string, drafts: object[], charts: object[]}>}
 */
async function fetchTurn(body) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'Chat failed')
  return { reply: data?.reply ?? '', drafts: data?.drafts ?? [], charts: data?.charts ?? [] }
}

/**
 * Chat state machine for the AI assistant tab: conversations, greeting state, text input,
 * and the streamed reply. Chats and messages persist per user, from Atlas or the device depending
 * on the connection.
 * @returns {object} Chat state and actions for AiTab to render.
 */
export function useAiChat() {
  const { isOnline, refresh, watchTransfer } = useWalletData()
  const [chats, setChats] = useState([{ id: 'draft', title: NEW_CHAT_TITLE, messages: [] }])
  const [activeId, setActiveId] = useState('draft')
  // Opens on a fresh chat; history is one tap away from the thread header.
  const [view, setView] = useState('chat') // 'chat' | 'history'
  const [textInput, setTextInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
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
      // A re-draft (editing the note or amount) supersedes the prior unconfirmed card for the same
      // person so only the current one is confirmable.
      const upsertDraftCard = (draft) =>
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== threadId()) return c
            const isStaleDraft = (m) =>
              m.type === 'action' &&
              !m.actionData.isConfirmed &&
              m.actionData.mode === draft.mode &&
              m.actionData.contact?.reference === draft.contact?.reference
            return {
              ...c,
              messages: [
                ...c.messages.filter((m) => !isStaleDraft(m)),
                { id: nextId(), role: 'assistant', type: 'action', actionData: { ...draft, isConfirmed: false } },
              ],
            }
          }),
        )
      try {
        const { reply, drafts, charts } = await fetchTurn({ message: text, history, isOnline: isOnlineRef.current })
        setIsThinking(false)
        // Cards land first (above the reply); then the reply reveals via the typewriter. `done` lets
        // the typewriter run once over the finished text and mark itself so it never replays.
        drafts.forEach(upsertDraftCard)
        charts.forEach((chart) => {
          const card = { type: 'chart', chartTitle: chart.title, chartData: chart.rows }
          appendToThread({ id: nextId(), role: 'assistant', ...card })
          // Persist alongside the reply so the chart is still there when the chat is reopened.
          if (reference) appendChatCard(reference, card, isOnlineRef.current)
        })
        if (reply) {
          appendToThread({ id: replyId, role: 'assistant', type: 'text', text: reply, stream: 'done' })
          if (reference) appendChatMessage(reference, { role: 'assistant', text: reply }, isOnlineRef.current)
        }
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

  const handleScrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, isThinking])

  /** The card is the confirm step: nothing moved until the user tapped it. */
  async function handleConfirmAction(id) {
    const message = msgs.find((m) => m.id === id)
    const draft = message?.actionData
    // `isConfirmed` is only set once the call resolves, so it cannot guard the window during it.
    if (!draft || draft.isConfirmed || confirmingId) return
    setConfirmingId(id)

    // The note may have been edited on the card; store the bare phrase, since the card shows "For <note>".
    const note = (draft.note ?? '').trim().replace(/^for\s+/i, '')
    const result =
      draft.mode === 'request'
        ? await createRequest({
            counterpartyArrangementReference: draft.contact.reference,
            amount: draft.amount,
            note,
            isOnline,
          })
        : await sendMoney({
            counterpartyArrangementReference: draft.contact.reference,
            amount: draft.amount,
            note,
            isOnline,
          })

    if (!result.ok) {
      setConfirmingId(null)
      patchActive((c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: nextId(), role: 'assistant', type: 'text', text: result.error },
        ],
      }))
      return
    }
    setConfirmingId(null)
    // Keep what actually happened, so the card reports it instead of a fixed "Sent". Offline both
    // kinds are only queued; a real send then settles under its reference, which the card follows.
    const isQueued = !isOnline
    patchActive((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              actionData: {
                ...m.actionData,
                isConfirmed: true,
                isQueued,
                reference: result.reference ?? null,
              },
            }
          : m,
      ),
    }))
    if (draft.mode === 'request') refresh(['requests'])
    else {
      refresh(['accounts', 'transactions'])
      if (!isQueued) watchTransfer(result.reference)
    }
  }

  /** Edit a pending draft's note on the card, so changing it never depends on the model re-drafting. */
  function handleEditNote(id, note) {
    patchActive((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === id && m.type === 'action' && !m.actionData.isConfirmed
          ? { ...m, actionData: { ...m.actionData, note } }
          : m,
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
    setIsThinking(false)
    setTextInput('')
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
    isThinking,
    confirmingId,
    endRef,
    hasText: textInput.trim().length > 0,
    handleScrollToEnd,
    handleConfirmAction,
    handleEditNote,
    handleSendText,
    handleSuggestion,
    handleOpenChat,
    handleDeleteChat,
  }
}
