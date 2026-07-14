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

/** Server-only auth config, sourced from frontend/.env.local (never NEXT_PUBLIC_). */
export const ENV = {
  pspBaseUrl: () => envVar('PSP_BASE_URL') ?? '',
  clientId: () => envVar('CLIENT_ID') ?? '',
  clientSecret: () => envVar('CLIENT_SECRET') ?? '',
  appBaseUrl: () => envVar('APP_BASE_URL') ?? 'http://localhost:3000',
  redirectUri: () =>
    envVar('REDIRECT_URI') ?? `${envVar('APP_BASE_URL') ?? 'http://localhost:3000'}/api/auth/callback`,
  sessionSecret: () => envVar('SESSION_SECRET') ?? '',
  // Browser-facing hosted login page. The API /authorize returns JSON, so the browser is sent to the
  // PSP frontend page instead. Defaults to the base host's /auth/authorize.
  authorizeUrl: () => envVar('PSP_AUTHORIZE_URL') ?? `${envVar('PSP_BASE_URL') ?? ''}/auth/authorize`,
  // Expected id_token issuer. Optional: only enforced when set (the PSP stamps iss from its own base URL).
  issuer: () => envVar('PSP_ISSUER'),
}
