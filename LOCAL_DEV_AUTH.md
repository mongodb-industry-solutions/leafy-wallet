# Local dev auth — passing the corp SSO gate

The frontend is a BFF: it makes **server-side** calls to the deployed Leafy Pay PSP (token exchange,
JWKS, and the wallet API). That PSP host sits behind MongoDB's corporate SSO gate
(Istio/Envoy → `login.corp.mongodb.com`).

- Your **browser** passes the gate — it carries a corp session.
- The **Node server** (your local `npm run dev`) does not. So every server-side request gets `302`'d
  to `login.corp` and fails (you'll see the token exchange or JWKS fetch error out).

To develop locally against the deployed PSP, the server needs to present the same corp session your
browser has. That's what `PSP_DEV_COOKIE` is for.

## This is local-only, and gated on `NODE_ENV`

The cookie is read **only when `NODE_ENV !== 'production'`** (see `frontend/src/lib/auth/env.js`,
`ENV.pspDevCookie`). When the app is deployed on MongoDB's own infra, server-to-server traffic isn't
gated, so the cookie is never read and the whole mechanism is inert — nothing to configure, nothing to
remove. It exists purely so a laptop can reach the gated staging host.

## Setup

1. In your **browser** (logged into corp), open the PSP discovery URL directly — it should return JSON:

   ```
   <PSP_BASE_URL>/.well-known/openid-configuration
   ```

   (`PSP_BASE_URL` is the backend host in `frontend/.env.local`.)

2. Open **DevTools → Network → reload the tab**, click the `openid-configuration` request, go to
   **Headers → Request Headers**, and copy the **entire** `cookie:` value. The `auth_user` /
   `auth_claim_*` / `auth_token` cookies are the corp session; copying the whole header is fine.

3. Add it to `frontend/.env.local`, **in double quotes** (the value contains `;` and spaces):

   ```
   PSP_DEV_COOKIE="…paste the whole cookie here…"
   ```

4. Restart the dev server (`.env.local` is only read at startup):

   ```
   cd frontend && npm run dev
   ```

Log in — the server now attaches that cookie to every PSP request and passes the gate like your browser
does.

## Notes

- **It expires** (a few hours — it's a live session token). When auth starts failing again with a gate
  redirect (`token exchange failed: 401`, or `Expected 200 OK from the JWKS response`), re-copy the
  cookie and replace the value.
- **Never commit it.** `.env.local` is gitignored; the value is your personal corp session.
- It's a stopgap. If the gate is ever opened for server-to-server to the PSP host, just delete
  `PSP_DEV_COOKIE` from `.env.local` and everything works without it.

## Where it's wired

`ENV.pspDevCookie()` is attached as a `Cookie:` header (only when non-empty) on every server→PSP call:

- `frontend/src/lib/auth/oauth.js` — token exchange, refresh, revoke, userinfo, CIBA, and the JWKS
  fetch (routed through the same helper via jose's `customFetch`).
- `frontend/src/lib/psp/PspClient.js` — the wallet API reads/writes.
- `frontend/src/lib/auth/actions.js` — the passwordless/CIBA relays.
