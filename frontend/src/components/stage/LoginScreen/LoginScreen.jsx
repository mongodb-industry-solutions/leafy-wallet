'use client'

import { Peep } from '@/components/common/Peep/Peep'
import { DEMO_USERS } from '@/lib/demo-users'

const SSO_PROVIDER = 'Continue with SSO'
const SSO_LOGIN_URL = '/api/auth/login'

/**
 * First-run login screen: hero art, a row of demo-user profile cards, then the real SSO button.
 * Tapping a profile card starts the Leafy Pay authorization_code + PKCE flow with that user's email
 * prefilled; "Continue with SSO" starts the same flow with an empty login form. The password is
 * always typed by hand - the walkthrough is where it is shown.
 */
export function LoginScreen() {
  // Full-page navigation: hands off to Leafy Pay's hosted login, which redirects back to the app.
  function handleLogin(email) {
    window.location.href = email ? `${SSO_LOGIN_URL}?user=${encodeURIComponent(email)}` : SSO_LOGIN_URL
  }

  return (
    <div className="relative flex h-full flex-col bg-white pb-8 text-foreground">
      {/* Hero art, centered toward the top. */}
      <div className="flex flex-1 items-start justify-center pt-20">
        <img src="/login-head.png" alt="" className="w-[22rem] max-w-[94%]" />
      </div>

      <div className="relative flex flex-col gap-4 px-6">
        {/* One profile card per demo user. */}
        <div className="flex justify-center gap-3">
          {DEMO_USERS.map((user) => {
            const { seed, bg } = user
            return (
              <button
                key={user.email}
                type="button"
                onClick={() => handleLogin(user.email)}
                className="flex flex-1 flex-col items-center gap-2.5 rounded-2xl border border-border bg-card px-2 py-5 shadow-sm transition-opacity hover:opacity-90"
              >
                <Peep seed={seed} bg={bg} size={72} />
                <span className="text-[15px] font-semibold text-foreground">{user.name.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Divider between the demo profiles and the generic SSO entry point. */}
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => handleLogin()}
          className="flex h-14 items-center justify-center rounded-full bg-black text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {SSO_PROVIDER}
        </button>

        <div className="flex items-center justify-center gap-6 text-sm font-medium text-muted-foreground">
          <span>Privacy policy</span>
          <span>Terms of service</span>
        </div>
      </div>
    </div>
  )
}
