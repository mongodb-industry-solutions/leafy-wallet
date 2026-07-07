'use client'

import Icon from '@leafygreen-ui/icon'
import { TRANSACTIONS } from '@/lib/wallet-data'
import { TxRow } from '@/components/wallet/transactions/tx-row'
import { cn } from '@/lib/utils'

const CARDS = [
  { currency: '€', amount: '12,458.32', sub: 'Sending €45.00', pending: true, last4: '7984', tone: 'green' },
  { currency: '$', amount: '2,144.89', sub: '+$60.00 today', last4: '5689', tone: 'blue' },
  { currency: '£', amount: '860.10', sub: '-£12.40 today', last4: '3312', tone: 'neutral' },
]

const TONES = {
  green: 'bg-gradient-to-br from-[#00A35C] to-secondary text-white',
  blue: 'bg-gradient-to-br from-[#2AA9F5] to-info text-white',
  neutral: 'bg-gradient-to-br from-[#2A3843] to-foreground text-white',
}

const CTAS = [
  { id: 'send', label: 'Send', glyph: 'ArrowUp', color: 'text-secondary' },
  { id: 'request', label: 'Request', glyph: 'ArrowDown', color: 'text-info' },
  // Teal reads as the MongoDB AI green→blue blend, distinct from Send/Request.
  { id: 'chat', label: 'Chat', glyph: 'Sparkle', color: 'text-[#0499C7]' },
]

export function HomeTab({ onSetTab, onDetail, onSend, onRequest }) {
  const onCta = { send: onSend, request: onRequest, chat: () => onSetTab('ai') }

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-6">
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4">
        {CARDS.map((c, i) => {
          const subGlyph = c.pending ? 'Pending' : c.sub.startsWith('-') ? 'Minus' : 'Plus'
          const subText = c.pending ? c.sub : c.sub.replace(/^[+-]\s?/, '')
          return (
            <div
              key={i}
              className={cn('flex w-[86%] flex-none snap-start flex-col rounded-3xl p-5', TONES[c.tone])}
            >
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Balance</p>
              <div className="mt-2 flex items-baseline gap-1 tabular-nums">
                <span className="text-2xl font-bold opacity-70">{c.currency}</span>
                <span className="text-[2.75rem] font-bold leading-none tracking-tight">{c.amount}</span>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 self-start rounded-full bg-white/15 py-1 pr-2.5 pl-2 text-xs font-semibold tabular-nums">
                <Icon glyph={subGlyph} size={13} />
                {subText}
              </span>
              <div className="mt-6 flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-70">
                <span className="font-mono tracking-normal">•••• {c.last4}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-current" />
                  Active
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        {CTAS.map(({ id, label, glyph, color }) => (
          <button
            key={id}
            onClick={onCta[id]}
            className="flex min-h-24 flex-1 flex-col items-start justify-between rounded-2xl bg-foreground/[0.08] p-4 text-foreground transition-colors hover:bg-foreground/[0.14]"
          >
            <span className={color}>
              <Icon glyph={glyph} size={24} />
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>

      <section className="flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Transactions</h2>
          <button className="text-sm font-semibold text-secondary" onClick={() => onSetTab('activity')}>
            View All
          </button>
        </div>
        <div className="mt-1 flex flex-col divide-y divide-border">
          {TRANSACTIONS.map((tx) => (
            <TxRow key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
          ))}
        </div>
      </section>
    </div>
  )
}
