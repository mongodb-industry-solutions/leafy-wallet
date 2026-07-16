import 'server-only'

// Scopes requested at login (subset of the OAuth client's granted scopes).
export const REQUESTED_SCOPES = [
  'openid',
  'profile',
  'email',
  'read:beneficiaries',
  'write:beneficiaries',
  'write:transfers',
  'read:accounts',
  'read:transactions',
]

/** Read an env var, treating empty strings as unset. */
function envVar(name) {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

/** Server-only config, sourced from frontend/.env.local (never NEXT_PUBLIC_). */
export const ENV = {
  // API/backend host: token/jwks/userinfo/revoke endpoints + the business API.
  pspBaseUrl: () => envVar('PSP_BASE_URL') ?? '',
  clientId: () => envVar('CLIENT_ID') ?? '',
  clientSecret: () => envVar('CLIENT_SECRET') ?? '',
  appBaseUrl: () => envVar('APP_BASE_URL') ?? 'http://localhost:3000',
  redirectUri: () =>
    envVar('REDIRECT_URI') ?? `${envVar('APP_BASE_URL') ?? 'http://localhost:3000'}/api/auth/callback`,
  sessionSecret: () => envVar('SESSION_SECRET') ?? '',
  // Browser-facing login page, on the frontend host (a different host from the API).
  authorizeUrl: () => `${envVar('PSP_FRONTEND_URL') ?? ''}/auth/authorize`,
  // Local-dev only: a corp SSO session cookie so server-side calls pass the Istio/Envoy gate that
  // fronts the deployed PSP. Inert in production (deployed on Mongo infra, server-to-server isn't
  // gated). See PSP_DEV_COOKIE in .env.local.
  pspDevCookie: () => (process.env.NODE_ENV === 'production' ? '' : envVar('PSP_DEV_COOKIE') ?? ''),
  // Blind-index key for contact/request lookup digests. Separate from SESSION_SECRET so rotating
  // one doesn't invalidate the other — rotating this orphans every stored digest.
  lookupDigestKey: () => envVar('LOOKUP_DIGEST_KEY') ?? '',
}
