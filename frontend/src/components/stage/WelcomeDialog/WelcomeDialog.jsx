'use client'

import { Check, Copy, KeyRound, X } from 'lucide-react'
import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'
import { DEMO_USERS } from '@/lib/demo-users'
import { useCopyToClipboard } from '@/components/stage/WelcomeDialog/useCopyToClipboard'

// Every demo user shares one password, so show it once. Sourced from DEMO_USERS to keep a single
// source of truth with the sign-in walkthrough step. The user profiles themselves are not listed here -
// they are already on the login screen behind this panel, so repeating them would be redundant.
const SHARED_PASSWORD = DEMO_USERS[0].password

/**
 * Pre-auth welcome overlay for an unattended booth visitor. Visitors already know roughly what the
 * demo is, so it skips the pitch. A minimal two-part hero orients the stage (the phone is the wallet,
 * the card beside it narrates each screen), and the body carries the demo password (one tap to copy)
 * and the two actions. Overlays the whole stage and is never a blocking gate - the backdrop, the X,
 * and "Just let me try it" all dismiss it.
 * @param {object} props
 * @param {() => void} props.onStartTour - Primary action; records the tour intent and closes.
 * @param {() => void} props.onDismiss - Close without starting the tour.
 */
export function WelcomeDialog({ onStartTour, onDismiss }) {
  const { isCopied, copy } = useCopyToClipboard()

  function handleCopyPassword() {
    copy(SHARED_PASSWORD)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Dismiss" onClick={onDismiss} className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_60px_-24px_rgba(0,30,43,0.35)]">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/70 text-muted-foreground backdrop-blur transition-colors hover:bg-card hover:text-foreground"
        >
          <X size={18} />
        </button>

        {/* Hero: two minimal parts side by side. A clean device (the wallet) and a small card echoing
            the "Built on MongoDB" panel that narrates each screen. Restraint over detail. */}
        <div className="flex items-center justify-center gap-5 bg-gradient-to-b from-primary/20 via-primary/[0.05] to-transparent px-6 pb-9 pt-11">
          <div className="h-44 w-[5.5rem] shrink-0 rounded-[1.5rem] border-2 border-foreground/80 bg-white p-1.5 shadow-lg">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.15rem] bg-white px-2">
              <span className="mx-auto mt-1.5 h-1 w-6 rounded-full bg-foreground/70" />
              <div className="mt-5 flex items-center gap-1.5">
                <span className="size-4 shrink-0 rounded-full bg-secondary/80" />
                <span className="h-1.5 w-11 rounded-full bg-foreground/10" />
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                <span className="h-1.5 w-full rounded-full bg-foreground/[0.08]" />
                <span className="h-1.5 w-4/5 rounded-full bg-foreground/[0.08]" />
                <span className="h-1.5 w-3/5 rounded-full bg-foreground/[0.08]" />
              </div>
            </div>
          </div>

          <div className="flex w-40 shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg">
            <div className="flex items-center gap-1.5">
              <LeafLogo size={15} />
              <span className="text-[11px] font-bold text-foreground">Built on MongoDB</span>
            </div>
            <span className="h-1.5 w-full rounded-full bg-foreground/[0.08]" />
            <span className="h-1.5 w-2/3 rounded-full bg-foreground/[0.08]" />
          </div>
        </div>

        {/* Body: greeting, the one-line orientation, the demo password, and the two actions. */}
        <div className="flex flex-col gap-4 px-7 pb-7 pt-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Welcome to Leafy Wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The panel on the right explains what MongoDB is doing on each screen.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Sign in as any profile. They all share the same password.
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-foreground/[0.03] px-4 py-3">
              <KeyRound size={17} className="shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-semibold text-foreground">{SHARED_PASSWORD}</span>
              <button
                type="button"
                onClick={handleCopyPassword}
                aria-label={`Copy password ${SHARED_PASSWORD}`}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-secondary/10"
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onStartTour}
              className="flex h-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Watch the tour
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-12 items-center justify-center rounded-full bg-foreground/[0.06] text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.1]"
            >
              Just let me try it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
