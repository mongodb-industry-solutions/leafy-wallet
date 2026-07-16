'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { Ico } from '@/components/common/Icons/Icons'
import { FoldGradient } from '@/components/common/FoldGradient/FoldGradient'
import { BouncingDots } from '@/components/common/BouncingDots/BouncingDots'
import { cn } from '@/lib/utils'
import { ActionCard } from '@/components/wallet/assistant/ActionCard/ActionCard'
import { SpendingChart } from '@/components/wallet/assistant/SpendingChart/SpendingChart'
import { ChatHeader } from './ChatHeader'
import { ChatHistory } from './ChatHistory'
import { EmptyState } from './EmptyState'
import { useAiChat } from './useAiChat'

const TYPE_SPEED_MS = 16

/**
 * Typewrites `text` when `animate` is true (else renders in full), calling `onDone` once complete.
 */
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
  const c = useAiChat()
  // Ids whose typewriter has finished, so re-rendering (or re-opening a chat)
  // never replays it.
  const streamedRef = useRef(new Set())

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) c.handleSendText()
  }

  if (c.view === 'history') {
    return (
      <ChatHistory
        chats={c.chats}
        activeId={c.activeId}
        onOpen={c.handleOpenChat}
        onNew={c.handleNewChat}
        onClose={() => c.setView('chat')}
      />
    )
  }

  // Greeting shows until the user starts composing or the thread has messages.
  const showEmpty = c.isEmpty && !c.hasText
  const auroraShown = c.isThinking || showEmpty
  let auroraOpacity = 0
  if (c.isThinking) auroraOpacity = 1
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
                animation: c.isThinking ? 'aurora-pulse 2s ease-in-out infinite' : 'none',
              }}
            >
              <FoldGradient riseMs={0} />
            </div>
          </div>
        </div>
      </div>

      <ChatHeader title={c.title} onBack={() => c.setView('history')} onNew={c.handleNewChat} />

      {showEmpty ? (
        <EmptyState user={user} onSuggestion={c.handleSuggestion} />
      ) : (
        <div className="no-scrollbar relative z-10 flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-32">
          {c.msgs.map((m) => {
            if (m.type === 'action') {
              return (
                <div key={m.id} className="flex justify-start">
                  <ActionCard msg={m} onConfirm={c.handleConfirmAction} onExpand={c.handleScrollToEnd} />
                </div>
              )
            }
            if (m.type === 'chart') {
              return (
                <div key={m.id} className="flex justify-start">
                  <SpendingChart data={m.chartData} />
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
            return (
              <p key={m.id} className="max-w-[92%] text-sm leading-relaxed text-foreground">
                <Typewriter
                  text={m.text}
                  animate={Boolean(m.stream) && !streamedRef.current.has(m.id)}
                  onDone={() => streamedRef.current.add(m.id)}
                />
              </p>
            )
          })}

          {c.isListening && c.transcript && (
            <div className="flex justify-end">
              <div className="max-w-[82%] rounded-2xl bg-foreground px-3.5 py-2.5 text-sm text-background/70">
                {c.transcript}
                <span className="ml-0.5 animate-pulse">|</span>
              </div>
            </div>
          )}

          {c.isThinking && (
            <div className="py-1">
              <BouncingDots className="w-8 text-muted-foreground" />
            </div>
          )}
          <div ref={c.endRef} />
        </div>
      )}

      {/* Full-width floating bar with a fade, so messages slide under it and
          clip at the input rather than a hard edge above it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-muted from-45% to-transparent px-4 pt-10 pb-24">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card py-2 pr-2 pl-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          <input
            value={c.textInput}
            onChange={(e) => c.setTextInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask anything…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {c.hasText ? (
            <button
              onClick={c.handleSendText}
              aria-label="Send"
              className="grid size-9 flex-none place-items-center rounded-full bg-foreground text-background"
            >
              <Icon glyph="ArrowUp" size={18} />
            </button>
          ) : (
            <button
              onClick={c.isListening ? c.handleStop : c.handleStart}
              aria-label={c.isListening ? 'Stop' : 'Voice'}
              className={cn(
                'grid size-9 flex-none place-items-center rounded-full',
                c.isListening
                  ? 'bg-gradient-to-br from-[#00A35C] to-[#006EFF] text-white'
                  : 'bg-foreground text-background',
              )}
            >
              <Ico.Mic size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
