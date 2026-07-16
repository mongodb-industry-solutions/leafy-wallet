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
  // Corp SSO session cookie: lets server-side calls through the gate fronting the
  // staging PSP. Set only in .env.local; unset when deployed inside the corp network.
  pspDevCookie: () => envVar('PSP_DEV_COOKIE') ?? '',
  // Blind-index key for contact/request lookup digests. Rotating it orphans every stored digest.
  lookupDigestKey: () => envVar('LOOKUP_DIGEST_KEY') ?? '',
}
