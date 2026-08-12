'use client'

import { useEffect, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { Mic, Square } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { FoldGradient } from '@/components/common/FoldGradient'
import { ActionCard } from '@/components/wallet/assistant/ActionCard'
import { SpendingChart } from '@/components/wallet/assistant/SpendingChart'
import { ChatHeader } from './ChatHeader'
import { ChatHistory } from './ChatHistory'
import { ChatGreeting } from './ChatGreeting'
import { useAiChat } from './useAiChat'
import { useSpeechInput } from './useSpeechInput'

const TYPE_SPEED_MS = 16

/** Reveals `text` one character at a time when `animate`, else renders it in full. */
function Typewriter({ text, animate, onDone }) {
  const [count, setCount] = useState(animate ? 0 : text.length)
  useEffect(() => {
    if (!animate) return
    if (count >= text.length) {
      onDone?.()
      return
    }
    const id = setTimeout(() => setCount((c) => c + 1), TYPE_SPEED_MS)
    return () => clearTimeout(id)
  }, [count, text, animate, onDone])
  return <>{text.slice(0, count)}</>
}

/**
 * The "Chat" tab (Leafy AI): greeting empty-state, message thread, and saved history, with all
 * state/logic in {@link useAiChat}.
 * @param {object} props
 * @param {{name: string}} props.user - The authenticated identity, for the greeting.
 */
export function AiTab({ user }) {
  const {
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
    hasText,
    handleScrollToEnd,
    handleConfirmAction,
    handleEditNote,
    handleSendText,
    handleSuggestion,
    handleOpenChat,
    handleDeleteChat,
  } = useAiChat()
  // Ids whose typewriter has finished, so re-rendering (or re-opening a chat) never replays it.
  const [revealedIds, setRevealedIds] = useState(() => new Set())
  // A dictated phrase is sent the moment it lands, so speaking is a whole turn without a second tap.
  const {
    isSupported: canDictate,
    isListening,
    interim,
    error: micError,
    toggle: toggleMic,
    stop: stopMic,
  } = useSpeechInput({ onTranscript: handleSuggestion })

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleSendText()
  }

  function handleRevealed(id) {
    setRevealedIds((prev) => new Set(prev).add(id))
  }

  // Leaving the thread for the history list drops a live mic with it.
  useEffect(() => {
    if (view === 'history') stopMic()
  }, [view, stopMic])

  if (view === 'history') {
    return (
      <ChatHistory
        chats={chats}
        activeId={activeId}
        onOpen={handleOpenChat}
        onDelete={handleDeleteChat}
      />
    )
  }

  // Greeting shows until the user starts composing or the thread has messages.
  const showEmpty = isEmpty && !hasText
  const auroraShown = isThinking || showEmpty
  let auroraOpacity = 0
  if (isThinking) auroraOpacity = 1
  else if (showEmpty) auroraOpacity = 0.55

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted text-foreground">
      {/* Aurora: ambient on the greeting, pulsing while thinking, hidden deep in
          a thread. Rendered wide + flat so it reads as bands, not a radial blob. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-0 aspect-[1271/599] w-[130%] -translate-x-1/2"
        style={{
          opacity: auroraOpacity,
          transition: 'opacity 900ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="h-full w-full rotate-180">
          {/* Expand while shown, closing to a 1% sliver when thinking stops.
              origin bottom = the screen's top after the flip. */}
          <div
            className="h-full w-full"
            style={{
              transformOrigin: 'bottom',
              transform: auroraShown ? 'scaleY(1)' : 'scaleY(0.01)',
              transition: 'transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              className="h-full w-full"
              style={{
                transformOrigin: 'bottom',
                animation: isThinking ? 'aurora-pulse 2s ease-in-out infinite' : 'none',
              }}
            >
              <FoldGradient />
            </div>
          </div>
        </div>
      </div>

      <ChatHeader title={title} onBack={() => setView('history')} />

      {showEmpty ? (
        <ChatGreeting user={user} onSuggestion={handleSuggestion} />
      ) : (
        <div className="no-scrollbar relative z-10 flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-44">
          {msgs.map((m) => {
            if (m.type === 'action') {
              return (
                <div key={m.id} className="flex justify-start">
                  <ActionCard
                    msg={m}
                    isBusy={confirmingId === m.id}
                    onConfirm={handleConfirmAction}
                    onEditNote={handleEditNote}
                    onExpand={handleScrollToEnd}
                  />
                </div>
              )
            }
            if (m.type === 'chart') {
              return (
                <div key={m.id} className="flex justify-start">
                  <SpendingChart data={m.chartData} title={m.chartTitle} />
                </div>
              )
            }
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl bg-foreground px-3.5 py-2.5 text-sm text-background">
                    {m.text}
                  </div>
                </div>
              )
            }
            const isUnrevealed = m.stream === 'done' && !revealedIds.has(m.id)
            return (
              <p key={m.id} className="max-w-[92%] text-sm leading-relaxed text-foreground">
                <Typewriter
                  text={m.text}
                  animate={isUnrevealed}
                  onDone={() => handleRevealed(m.id)}
                />
              </p>
            )
          })}

          {isThinking && (
            <div role="status" className="flex items-center gap-2 py-1.5">
              {/* Pinned: the app is light-only, and `auto` would paint light ink on a dark-mode OS. */}
              <ThinkingOrb state="working" size={20} theme="light" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Thinking…</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Full-width floating bar with a fade, so messages slide under it and
          clip at the input rather than a hard edge above it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-muted from-45% to-transparent px-4 pt-10 pb-24">
        {micError && (
          <p role="alert" className="pointer-events-auto pb-2 text-center text-xs text-muted-foreground">
            {micError === 'not-allowed' || micError === 'service-not-allowed'
              ? 'Microphone access is blocked. Allow it in your browser settings to speak.'
              : `Voice input failed: ${micError}`}
          </p>
        )}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card py-2 pr-2 pl-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          <input
            data-tour-target="ai-input"
            value={isListening ? interim : textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            readOnly={isListening}
            placeholder={isListening ? 'Listening…' : 'Ask anything…'}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {canDictate && !hasText && (
            <button
              data-tour-target="ai-mic"
              onClick={toggleMic}
              disabled={isThinking}
              aria-label={isListening ? 'Stop listening' : 'Speak'}
              aria-pressed={isListening}
              className={`grid size-9 flex-none place-items-center rounded-full transition-colors disabled:opacity-40 ${
                isListening
                  ? 'animate-pulse bg-foreground text-background'
                  : 'bg-muted text-foreground'
              }`}
            >
              {isListening ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}
            </button>
          )}
          <button
            data-tour-target="ai-send"
            onClick={handleSendText}
            disabled={!hasText}
            aria-label="Send"
            className="grid size-9 flex-none place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
          >
            <Icon glyph="ArrowUp" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
