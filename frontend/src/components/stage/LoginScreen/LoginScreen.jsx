'use client'

/** Apple wordmark glyph for the mock "Continue with Apple" button. */
function AppleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  )
}

/** Multi-color Google "G" for the mock "Continue with Google" button. */
function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z" />
    </svg>
  )
}

const SSO_PROVIDER = 'Continue with SSO'

/**
 * First-run login screen (before the wallet app): an empty hero area (a
 * background image will be dropped in here) with the sign-in options below.
 * Apple/Google are mock decoration; only "Continue with SSO" is wired (it calls
 * `onLogin`, standing in for the real Leafy Pay authorization_code + PKCE flow
 * in PLAN.md §2.2). Privacy/Terms are decorative.
 * @param {object} props
 * @param {() => void} props.onLogin - Enter the app (mock SSO success).
 */
export function LoginScreen({ onLogin }) {
  return (
    <div className="relative flex h-full flex-col bg-white pb-8 text-foreground">
      {/* Hero art, centered toward the top. */}
      <div className="flex flex-1 items-start justify-center pt-20">
        <img src="/login-head.png" alt="" className="w-[22rem] max-w-[94%]" />
      </div>

      <div className="relative flex flex-col gap-3 px-6">
        <button
          type="button"
          className="flex h-14 items-center justify-center gap-2.5 rounded-full border border-border bg-card text-base font-semibold text-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <AppleMark size={18} />
          Continue with Apple
        </button>
        <button
          type="button"
          className="flex h-14 items-center justify-center gap-2.5 rounded-full border border-border bg-card text-base font-semibold text-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <GoogleMark size={18} />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="flex h-14 items-center justify-center rounded-full bg-black text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {SSO_PROVIDER}
        </button>

        <div className="mt-3 flex items-center justify-center gap-6 text-sm font-medium text-muted-foreground">
          <span>Privacy policy</span>
          <span>Terms of service</span>
        </div>
      </div>
    </div>
  )
}
