'use client'

import Icon from '@leafygreen-ui/icon'
import { BALANCE, TRANSACTIONS } from '@/lib/wallet-data'
import { MULTI_CURRENCY_ENABLED } from '@/lib/features'
import { HomeHero } from '@/components/wallet/home/HomeHero/HomeHero'
import { TxRow } from '@/components/wallet/transactions/TxRow/TxRow'

// Green wash behind the hero. Stays in-hue with eased, mostly-opaque tint
// steps (a linear-gradient version of the reference's color→transparent wash)
// so it diffuses smoothly instead of greying out, only going transparent once
// it's already pale enough to blend seamlessly into the page background.
const HERO_GRADIENT =
  'linear-gradient(180deg, #012a1f 0%, #023d2c 16%, #0a5942 34%, #3a7d64 50%, #79a693 64%, #b1cfc3 76%, #dcebe4 88%, rgba(241,243,241,0) 100%)'

const EU_STAR_COUNT = 12
const EU_BLUE = '#003399'
const EU_GOLD = '#FFCC00'

// Other accounts kept for when MULTI_CURRENCY_ENABLED is turned back on.
const ALL_ACCOUNTS = [
  { code: 'EUR', label: 'EURO account', last4: '7523', amount: '12,458.32' },
  { code: 'CNY', label: 'Yuan account', last4: '2044', amount: '2,500,000.00' },
]
const ACCOUNTS = MULTI_CURRENCY_ENABLED ? ALL_ACCOUNTS : ALL_ACCOUNTS.slice(0, 1)

const CTAS = [
  { id: 'send', label: 'Send', glyph: 'ArrowUp', color: 'text-secondary' },
  { id: 'request', label: 'Request', glyph: 'ArrowDown', color: 'text-foreground' },
  // Teal reads as the MongoDB AI green→blue blend, the one non-green accent.
  { id: 'chat', label: 'Chat', glyph: 'Sparkle', color: 'text-[#0499C7]' },
]

/**
 * Splits a numeric balance into a thousands-separated integer part and a
 * two-digit cents part, so the cents can be rendered in a muted tone.
 * @param {number} value
 * @returns {{int: string, cents: string}}
 */
function formatBalance(value) {
  const [int, cents] = value.toFixed(2).split('.')
  return { int: int.replace(/\B(?=(\d{3})+(?!\d))/g, ','), cents }
}

/**
 * Groups a transaction list into runs of consecutive same-date entries, so the
 * Home preview can show a date header before each run.
 * @param {object[]} txs
 * @returns {{date: string, items: object[]}[]}
 */
function groupByDate(txs) {
  const groups = []
  for (const tx of txs) {
    const last = groups[groups.length - 1]
    if (last && last.date === tx.date) {
      last.items.push(tx)
    } else {
      groups.push({ date: tx.date, items: [tx] })
    }
  }
  return groups
}

/**
 * A circular EU flag badge (blue field, ring of gold stars) for the account
 * card. Coordinates are rounded so the SSR and client markup match exactly.
 */
function EuFlag({ size = 40 }) {
  const stars = Array.from({ length: EU_STAR_COUNT }, (_, i) => {
    const angle = (i / EU_STAR_COUNT) * 2 * Math.PI - Math.PI / 2
    const cx = (50 + 34 * Math.cos(angle)).toFixed(2)
    const cy = (50 + 34 * Math.sin(angle)).toFixed(2)
    return <circle key={i} cx={cx} cy={cy} r="4.5" fill={EU_GOLD} />
  })
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="flex-none" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={EU_BLUE} />
      {stars}
    </svg>
  )
}

/**
 * The "Home" tab: gradient hero, total balance, the EUR account card,
 * Send/Request/Chat shortcuts, and a date-grouped preview of recent transactions.
 * @param {object} props
 * @param {{name: string, handle: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onSignOut
 * @param {(tab: string) => void} props.onSetTab
 * @param {(tx: object) => void} props.onDetail - Opens the detail sheet for a transaction.
 * @param {() => void} props.onSend
 * @param {() => void} props.onRequest
 */
export function HomeTab({ user, onSignOut, onSetTab, onDetail, onSend, onRequest }) {
  const onCta = { send: onSend, request: onRequest, chat: () => onSetTab('ai') }
  const balance = formatBalance(BALANCE)
  const groups = groupByDate(TRANSACTIONS)

  return (
    <div className="relative flex flex-col">
      {/* Overscans the top edges so the phone's rounded corners stay green. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-4 -top-4 h-[20.5rem]"
        style={{ background: HERO_GRADIENT }}
      />

      <div className="relative flex flex-col">
        <HomeHero user={user} onSignOut={onSignOut} />

        {/* pt pushes the balance down into the white area near the gradient tail. */}
        <div className="flex flex-col gap-6 px-4 pt-32 pb-6">
          <div>
            {MULTI_CURRENCY_ENABLED && (
              <button className="mb-1.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Icon glyph="Plus" size={15} />
                Create account
              </button>
            )}
            <div className="flex items-baseline tracking-[-0.06em] tabular-nums">
              <span className="text-[2.4rem] font-normal leading-none">€</span>
              <span className="text-[2.4rem] font-bold leading-none">{balance.int}</span>
              <span className="text-[2.4rem] font-bold leading-none text-muted-foreground/70">
                .{balance.cents}
              </span>
            </div>
          </div>

          {/* Account card + shortcuts kept close together. */}
          <div className="flex flex-col gap-3">
            {ACCOUNTS.map((acct) => (
              <div
                key={acct.code}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <EuFlag size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{acct.label}</p>
                  <p className="text-xs font-medium tracking-tight text-muted-foreground tabular-nums">•••• {acct.last4}</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground">{acct.amount} €</span>
              </div>
            ))}

            <div className="flex gap-3">
              {CTAS.map(({ id, label, glyph, color }) => (
                <button
                  key={id}
                  onClick={onCta[id]}
                  className="flex min-h-24 flex-1 flex-col items-start justify-between rounded-xl border border-border bg-card p-4 text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  <span className={color}>
                    <Icon glyph={glyph} size={24} />
                  </span>
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-foreground">Transactions</h2>
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              {groups.map((group) => (
                <div key={group.date} className="px-1">
                  <p className="pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.date}
                  </p>
                  <div className="flex flex-col divide-y divide-border">
                    {group.items.map((tx) => (
                      <TxRow key={tx.id} tx={tx} onClick={() => onDetail(tx)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
