'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { SPENDING_DATA, findContact, parseIntent } from '@/lib/wallet-data'
import { useSpeech } from '@/hooks/use-speech'
import { Ico } from '@/components/common/icons'
import { AuroraGradient } from '@/components/common/aurora-gradient'
import { BouncingDots } from '@/components/common/bouncing-dots'
import { cn } from '@/lib/utils'
import { ActionCard } from './action-card'
import { SpendingChart } from './spending-chart'

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
      actionData: { contact, amount: intent.amount, note, mode: intent.type, confirmed: false },
    },
  ]
}

export function AiTab() {
  const [msgs, setMsgs] = useState([GREETING])
  const [textInput, setTextInput] = useState('')
  const [transcript, setTranscript] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)
  const timeoutRef = useRef(null)
  // Holds a send/request intent that's waiting on the user's note answer.
  const pendingRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const processText = useCallback((text) => {
    setMsgs((p) => [...p, { id: nextId(), role: 'user', type: 'text', text }])
    setTranscript('')
    setThinking(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setThinking(false)
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

  const { listening, start, stop } = useSpeech(processText, setTranscript)

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, thinking, transcript])

  function confirmAction(id) {
    setMsgs((p) =>
      p.map((m) => (m.id === id ? { ...m, actionData: { ...m.actionData, confirmed: true } } : m)),
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

  function sendText() {
    const t = textInput.trim()
    if (!t) return
    setTextInput('')
    processText(t)
  }

  const hasText = textInput.trim().length > 0

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* Aurora stays low & faint while idle, then rises up and brightens while
          the assistant is "thinking". Outer div drives the rise; inner div runs
          a constant gentle breathe (most visible once risen). */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[52%]"
        style={{
          transformOrigin: 'bottom',
          transform: thinking ? 'scaleY(1)' : 'scaleY(0.42)',
          opacity: thinking ? 0.72 : 0.1,
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
                <ActionCard msg={m} onConfirm={confirmAction} onExpand={scrollToEnd} />
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

        {listening && transcript && (
          <div className="flex justify-end">
            <div className="max-w-[82%] rounded-2xl bg-foreground/[0.07] px-3.5 py-2.5 text-sm text-muted-foreground">
              {transcript}
              <span className="ml-0.5 animate-pulse">|</span>
            </div>
          </div>
        )}

        {thinking && (
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) sendText()
            }}
            placeholder="Ask anything…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {hasText ? (
            <button
              onClick={sendText}
              aria-label="Send"
              className="grid size-9 flex-none place-items-center rounded-full bg-foreground text-background"
            >
              <Icon glyph="ArrowUp" size={18} />
            </button>
          ) : (
            <button
              onClick={listening ? stop : start}
              aria-label={listening ? 'Stop' : 'Voice'}
              className={cn(
                'grid size-9 flex-none place-items-center rounded-full',
                listening
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
