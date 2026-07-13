'use client'

import { useEffect, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { BALANCE, TRANSACTIONS } from '@/lib/wallet-data'
import { MULTI_CURRENCY_ENABLED } from '@/lib/features'
import { HomeHero } from '@/components/wallet/home/HomeHero/HomeHero'
import { TxRow } from '@/components/wallet/transactions/TxRow/TxRow'
import { FoldGradient } from '@/components/common/FoldGradient/FoldGradient'

const EU_STAR_COUNT = 12
const EU_BLUE = '#003399'
const EU_GOLD = '#FFCC00'

// Other accounts kept for when MULTI_CURRENCY_ENABLED is turned back on.
const ALL_ACCOUNTS = [
  { code: 'EUR', label: 'EURO account', last4: '7523', amount: '12,458.32' },
  { code: 'CNY', label: 'Yuan account', last4: '2044', amount: '2,500,000.00' },
]
const ACCOUNTS = MULTI_CURRENCY_ENABLED ? ALL_ACCOUNTS : ALL_ACCOUNTS.slice(0, 1)

// Send/Chat are short enough to pair with an icon. Request is left text-only
// so the longer word keeps even padding inside its pill.
const CTAS = [
  { id: 'send', label: 'Send', glyph: 'ArrowUp' },
  { id: 'request', label: 'Request' },
  { id: 'chat', label: 'Chat', glyph: 'Sparkle' },
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
 * Builds the points string for an upright 5-pointed star centered at (cx, cy).
 * Coordinates are rounded so the SSR and client markup match exactly.
 */
function starPoints(cx, cy, outer, inner) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** A circular EU flag badge: blue field with a ring of 12 gold stars. */
function EuFlag({ size = 40 }) {
  const stars = Array.from({ length: EU_STAR_COUNT }, (_, i) => {
    const angle = (i / EU_STAR_COUNT) * 2 * Math.PI - Math.PI / 2
    const cx = 50 + 33 * Math.cos(angle)
    const cy = 50 + 33 * Math.sin(angle)
    return <polygon key={i} points={starPoints(cx, cy, 6.2, 2.5)} fill={EU_GOLD} />
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
 * @param {{name: string, email: string, seed: string, bg: string}} props.user
 * @param {() => void} props.onSignOut
 * @param {() => void} [props.onProfile] - Opens the Profile screen.
 * @param {(tab: string) => void} props.onSetTab
 * @param {(tx: object) => void} props.onDetail - Opens the detail sheet for a transaction.
 * @param {() => void} props.onSend
 * @param {() => void} props.onRequest
 * @param {boolean} [props.playHeroIntro] - Animate the aurora open (set once per login).
 * @param {() => void} [props.onHeroIntroPlayed] - Marks the intro as played so remounts skip it.
 */
export function HomeTab({
  user,
  onSignOut,
  onProfile,
  onSetTab,
  onDetail,
  onSend,
  onRequest,
  playHeroIntro = false,
  onHeroIntroPlayed,
}) {
  const onCta = { send: onSend, request: onRequest, chat: () => onSetTab('ai') }
  const balance = formatBalance(BALANCE)
  const groups = groupByDate(TRANSACTIONS)

  // Capture the intro decision once on mount so it can't flip mid-animation.
  const [animateHero] = useState(playHeroIntro)
  const [heroExpanded, setHeroExpanded] = useState(!animateHero)
  useEffect(() => {
    if (!animateHero) return
    onHeroIntroPlayed?.()
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setHeroExpanded(true)))
    return () => cancelAnimationFrame(id)
  }, [animateHero, onHeroIntroPlayed])

  return (
    <div className="relative flex flex-col">
      {/* Overscans the top edges so the phone's rounded corners stay green. */}
      {/* FoldGradient behind the hero, flipped to hang from the top. The container
          keeps the true aspect ratio (1271:599) so it scales down without distorting. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-4 left-1/2 aspect-[1271/599] w-[230%] -translate-x-1/2 overflow-hidden"
      >
        <div className="h-full w-full rotate-180">
          {/* On first app open, expand from the top down, otherwise show instantly. */}
          <div
            className="h-full w-full"
            style={{
              transformOrigin: 'bottom',
              transform: heroExpanded ? 'scaleY(1)' : 'scaleY(0.01)',
              transition: animateHero ? 'transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          >
            <FoldGradient riseMs={0} />
          </div>
        </div>
      </div>

      <div className="relative flex flex-col">
        <HomeHero user={user} onSignOut={onSignOut} onProfile={onProfile} />

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

            <div className="flex gap-2.5">
              {CTAS.map(({ id, label, glyph }) => (
                <button
                  key={id}
                  onClick={onCta[id]}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
                >
                  {glyph && <Icon glyph={glyph} size={16} />}
                  {label}
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
