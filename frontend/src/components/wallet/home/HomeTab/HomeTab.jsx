'use client'

import { useEffect, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'
import { useWalletData } from '@/lib/wallet/WalletDataProvider'
import { HomeHero } from '@/components/wallet/home/HomeHero/HomeHero'
import { TxRow, TxRowSkeleton } from '@/components/wallet/transactions/TxRow/TxRow'
import { FoldGradient } from '@/components/common/FoldGradient/FoldGradient'
import { Skeleton } from '@/components/ui/Skeleton'

const TX_SKELETON_ROWS = 4

const EU_STAR_COUNT = 12
const EU_BLUE = '#003399'
const EU_GOLD = '#FFCC00'
const HOME_TX_PREVIEW = 6

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

/** Placeholder card matching an account card's layout, shown while accounts load. */
function AccountCardSkeleton() {
  return (
    <div className="flex w-[86%] flex-none items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <Skeleton className="size-10 flex-none rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
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
  const { accounts: accountsState, transactions: txState } = useWalletData()
  const accounts = accountsState.data ?? []
  const primaryAccount = accounts.find((a) => a.isDefault) ?? accounts[0]
  const balance = formatBalance(primaryAccount?.balanceValue ?? 0)
  const groups = groupByDate((txState.data ?? []).slice(0, HOME_TX_PREVIEW))

  let txEmptyMessage
  if (txState.error) txEmptyMessage = "Couldn't load transactions"
  else if (groups.length === 0) txEmptyMessage = 'No transactions yet'

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
          {accountsState.isLoading ? (
            <Skeleton className="h-[2.4rem] w-52" />
          ) : (
            <div className="flex items-baseline tracking-[-0.06em] tabular-nums">
              <span className="text-[2.4rem] font-normal leading-none">€</span>
              <span className="text-[2.4rem] font-bold leading-none">{balance.int}</span>
              <span className="text-[2.4rem] font-bold leading-none text-muted-foreground/70">
                .{balance.cents}
              </span>
            </div>
          )}

          {/* Account cards (horizontal, scrollable) + shortcuts kept close together. */}
          <div className="flex flex-col gap-3">
            {accountsState.isLoading ? (
              <div className="-mx-4 flex gap-3 overflow-hidden px-4">
                <AccountCardSkeleton />
                <AccountCardSkeleton />
              </div>
            ) : (
              <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-pl-4 px-4">
                {accounts.map((acct) => (
                  <div
                    key={acct.reference}
                    className={cn(
                      'flex flex-none snap-start items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm',
                      accounts.length > 1 ? 'w-[86%]' : 'w-full',
                    )}
                  >
                    <EuFlag size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{acct.label}</p>
                      <p className="text-xs font-medium tracking-tight text-muted-foreground tabular-nums">•••• {acct.last4}</p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">{acct.amount} €</span>
                  </div>
                ))}
              </div>
            )}

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
              {txState.isLoading && (
                <div className="flex flex-col divide-y divide-border px-1">
                  {Array.from({ length: TX_SKELETON_ROWS }).map((_, i) => (
                    <TxRowSkeleton key={i} />
                  ))}
                </div>
              )}
              {!txState.isLoading && txEmptyMessage && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">{txEmptyMessage}</p>
              )}
              {!txState.isLoading &&
                groups.map((group) => (
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
