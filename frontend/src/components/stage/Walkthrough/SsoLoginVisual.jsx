'use client'

/** macOS-style pointer, drawn inline so the cursor needs no asset. */
function Pointer({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M5 3l14 9.3-6.2 1.1 3.4 6.4-2.7 1.4-3.4-6.4L5 19.4V3z"
        fill="white"
        stroke="black"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Animated mini-render of the login screen for the walkthrough: the sign-in options, zoomed in,
 * with a cursor that glides onto "Continue with SSO" and clicks it on a loop. Pure CSS
 * (keyframes in globals.css), no images or timers.
 */
export function SsoLoginVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* The bottom of the login screen, blown up: two mock providers and the real SSO button. */}
      <div className="flex w-60 flex-col gap-2 rounded-2xl border border-border bg-white p-3.5 shadow-md">
        <p className="pb-0.5 text-center text-[11px] font-bold text-foreground">Sign in to Leafy Wallet</p>
        <div className="flex h-8 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-foreground/60">
          Continue with Apple
        </div>
        <div className="flex h-8 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-foreground/60">
          Continue with Google
        </div>
        <div className="relative">
          <div
            className="flex h-8 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white"
            style={{ animation: 'sso-button-press 4s ease-in-out infinite' }}
          >
            Continue with SSO
          </div>
          {/* Click feedback ring, centered where the cursor lands. */}
          <span
            className="pointer-events-none absolute right-10 top-1/2 -mt-2.5 size-5 rounded-full border-2 border-secondary"
            style={{ animation: 'sso-click-ring 4s ease-out infinite' }}
          />
          {/* The cursor's resting point sits on the button; the keyframes travel from off-tile. */}
          <span
            className="pointer-events-none absolute right-8 top-1/2 block"
            style={{ animation: 'sso-cursor 4s ease-in-out infinite' }}
          >
            <Pointer className="size-6 drop-shadow" />
          </span>
        </div>
      </div>
    </div>
  )
}
