'use client'

import Icon from '@leafygreen-ui/icon'
import { Ico } from '@/components/common/Icons/Icons'
import { AuroraGradient } from '@/components/common/AuroraGradient/AuroraGradient'
import { BouncingDots } from '@/components/common/BouncingDots/BouncingDots'
import { cn } from '@/lib/utils'
import { ActionCard } from '@/components/wallet/assistant/ActionCard/ActionCard'
import { SpendingChart } from '@/components/wallet/assistant/SpendingChart/SpendingChart'
import { useAiChat } from './useAiChat'

/**
 * The "Chat" tab: Leafy AI, a natural-language assistant for sending,
 * requesting, and checking spending. All chat state/logic lives in
 * {@link useAiChat}; this component only renders it.
 */
export function AiTab() {
  const {
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
  } = useAiChat()

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleSendText()
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* Aurora stays low & faint while idle, then rises up and brightens while
          the assistant is "thinking". Outer div drives the rise; inner div runs
          a constant gentle breathe (most visible once risen). */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[52%]"
        style={{
          transformOrigin: 'bottom',
          transform: isThinking ? 'scaleY(1)' : 'scaleY(0.42)',
          opacity: isThinking ? 0.72 : 0.1,
          transition:
            'transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="h-full w-full"
          style={{ transformOrigin: 'bottom', animation: 'aurora-breathe 2.6s ease-in-out infinite' }}
        >
          <AuroraGradient blur={30} riseMs={0} />
        </div>
      </div>

      <div className="relative z-10 px-5 pt-4 pb-2">
        <h2 className="w-fit bg-gradient-to-tr from-[#00A35C] from-20% to-[#006EFF] bg-clip-text text-lg font-bold text-transparent">
          Leafy AI
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Ask me anything about your money.</p>
      </div>

      <div className="no-scrollbar relative z-10 flex-1 space-y-3 overflow-y-auto px-5 py-3">
        {msgs.map((m) => {
          if (m.type === 'action') {
            return (
              <div key={m.id} className="flex justify-start">
                <ActionCard msg={m} onConfirm={handleConfirmAction} onExpand={handleScrollToEnd} />
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
                <div className="max-w-[82%] rounded-2xl bg-foreground/[0.07] px-3.5 py-2.5 text-sm">
                  {m.text}
                </div>
              </div>
            )
          }
          return (
            <p key={m.id} className="max-w-[92%] text-sm leading-relaxed text-foreground">
              {m.text}
            </p>
          )
        })}

        {isListening && transcript && (
          <div className="flex justify-end">
            <div className="max-w-[82%] rounded-2xl bg-foreground/[0.07] px-3.5 py-2.5 text-sm text-muted-foreground">
              {transcript}
              <span className="ml-0.5 animate-pulse">|</span>
            </div>
          </div>
        )}

        {isThinking && (
          <div className="py-1">
            <BouncingDots className="w-8 text-muted-foreground" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="relative z-10 px-4 pb-24 pt-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 py-2 pr-2 pl-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask anything…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {hasText ? (
            <button
              onClick={handleSendText}
              aria-label="Send"
              className="grid size-9 flex-none place-items-center rounded-full bg-foreground text-background"
            >
              <Icon glyph="ArrowUp" size={18} />
            </button>
          ) : (
            <button
              onClick={isListening ? handleStop : handleStart}
              aria-label={isListening ? 'Stop' : 'Voice'}
              className={cn(
                'grid size-9 flex-none place-items-center rounded-full',
                isListening
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
