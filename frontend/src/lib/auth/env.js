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
  'read:rtp',
  'write:rtp',
]

const DEFAULT_APP_BASE_URL = 'http://localhost:8080'

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
  appBaseUrl: () => envVar('APP_BASE_URL') ?? DEFAULT_APP_BASE_URL,
  redirectUri: () => envVar('REDIRECT_URI') ?? `${ENV.appBaseUrl()}/api/auth/callback`,
  sessionSecret: () => envVar('SESSION_SECRET') ?? '',
  // Browser-facing login page, on the frontend host (a different host from the API).
  authorizeUrl: () => `${envVar('PSP_FRONTEND_URL') ?? ''}/auth/authorize`,
}
