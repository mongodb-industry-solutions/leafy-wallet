import { describe, it, expect, beforeAll } from 'vitest'
import { buildAuthorizeUrl } from '@/lib/auth/oauth'
import { DEMO_USERS } from '@/lib/demo-users'

const PSP_FRONTEND_URL = 'https://leafy-pay.test'
const BASE = {
  state: 'state-value',
  nonce: 'nonce-value',
  codeChallenge: 'challenge-value',
  scopes: ['openid', 'profile'],
}

// ENV reads process.env on every call, so pinning the host here keeps the assertions independent of
// whatever .env.local vitest loaded.
beforeAll(() => {
  process.env.PSP_FRONTEND_URL = PSP_FRONTEND_URL
  process.env.CLIENT_ID = 'leafy-wallet'
})

// The login route hands Leafy Pay's hosted form the demo user's credentials, so tapping a profile
// card lands on a prefilled form. Only the SSO path leaves it empty.
describe('buildAuthorizeUrl', () => {
  it('carries the OIDC authorization_code + PKCE parameters', () => {
    const params = new URL(buildAuthorizeUrl(BASE)).searchParams
    expect(params.get('response_type')).toBe('code')
    expect(params.get('code_challenge')).toBe('challenge-value')
    expect(params.get('code_challenge_method')).toBe('S256')
    expect(params.get('scope')).toBe('openid profile')
  })

  it('prefills both credentials when a demo user was picked', () => {
    const user = DEMO_USERS[0]
    const params = new URL(
      buildAuthorizeUrl({ ...BASE, prefillEmail: user.email, prefillPassword: user.password }),
    ).searchParams
    expect(params.get('login_hint')).toBe(user.email)
    expect(params.get('prefill_password')).toBe(user.password)
  })

  it('never asks Leafy Pay to auto-submit: the visitor still confirms the login', () => {
    const user = DEMO_USERS[0]
    const params = new URL(
      buildAuthorizeUrl({ ...BASE, prefillEmail: user.email, prefillPassword: user.password }),
    ).searchParams
    expect(params.has('auto_login')).toBe(false)
  })

  it('leaves the form empty for Continue with SSO', () => {
    const params = new URL(buildAuthorizeUrl(BASE)).searchParams
    expect(params.has('login_hint')).toBe(false)
    expect(params.has('prefill_password')).toBe(false)
  })
})
