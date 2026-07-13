# Leafy Wallet — Architecture Plan

Status: **locked** — scope, data models, and endpoints are finalized against real source (the
`sec-fsi-pci-dss` repo's `develop`/`staging` branches), and the OAuth client is provisioned with the
full grant set this plan depends on.

## 1. What Leafy Wallet is

A P2P wallet demo. Leafy Wallet is registered as a **merchant** on Leafy Pay (an external,
BIAN-compliant PSP). Leafy Wallet's *users* are existing Leafy Pay **parties/customers** associated
with that merchant — Leafy Wallet doesn't create users, only references ones that already exist. All
money movement is **peer-to-peer**: a "contact" is a Leafy Pay **beneficiary** (`counterpartyArrangement`,
BIAN SD-54), a "send" is a Leafy Pay **P2P transfer** to that beneficiary (BIAN SD-65), executed *on
behalf of* the logged-in user via merchant OAuth — never a direct card/merchant charge.

Leafy Wallet owns a separate, smaller Atlas cluster used only as an **enrichment layer** — display
caching and one embedding field for the AI assistant — referencing Leafy Pay's records by their
instance references, never copying their PII or encrypted fields.

## 2. Identity — SSO first login, passwordless opt-in after

Ported directly from the `sec-fsi-pci-dss` repo's `merchant/` (Espresso Works) reference on
`staging`. **One** deviation: Espresso Works shows both a "Login with Leafy Pay" button and, when a
credential exists, a second "log in without password" button — the user picks. Leafy Wallet never
shows that choice: it checks for a local credential and auto-runs whichever path applies.

### 2.1 OAuth client — provisioned

Revoked and recreated with all three grant types together (`grant_types`/`scopes` are unrestricted on
the create endpoint, unlike `PATCH`):

- `grant_types`: `authorization_code`, `refresh_token`, `urn:openid:params:grant-type:ciba`
- `scopes` (8): `openid`, `profile`, `email`, `read:beneficiaries`, `write:beneficiaries`,
  `write:transfers`, `read:accounts`, `read:transactions`
- `require_pkce: true`
- `redirect_uris`: `http://localhost:8000/api/v1/auth/callback` (placeholder for local dev — `PATCH
  .../oauth-client {redirect_uris}` to the real deployed URL once it exists, no grant-type
  restriction on that field)

`client_id`/`client_secret`/`client_secret_prefix` saved to `leafy-wallet-backend`'s `.env.local`.

### 2.2 First-time login: SSO (authorization_code + PKCE)

1. Browser → `GET backend/auth/login` → backend generates PKCE + state/nonce, redirects to Leafy
   Pay's hosted `/auth/authorize` page.
2. User logs in with their real Leafy Pay credentials, on Leafy Pay's own page.
3. Leafy Pay redirects to `GET backend/auth/callback?code&state`.
4. Backend exchanges the code for tokens, verifies the `id_token`, sets the session cookie (§2.5).

This lands the user in Leafy Wallet's **Profile** screen, which offers "enable passwordless login."

### 2.3 Enabling passwordless (opt-in, from Profile)

1. Frontend generates an ES256 keypair via WebCrypto — private key **non-extractable**, stored as a
   `CryptoKey` handle in IndexedDB (can't be exfiltrated even under XSS). Only the public key ever
   leaves the browser.
2. Backend relays `POST /api/v1/auth/enroll/challenge` to Leafy Pay, **authenticated with the same
   OAuth access token from the session cookie** (the SSO login's token — no separate first-party
   session needed; this is exactly what the reference does and it works).
3. Frontend signs the challenge locally.
4. Backend relays `POST /api/v1/auth/enroll {challenge, publicKeyPem, alg, signature, credentialId,
   authenticatorMetadata?}` with the same Bearer.
5. Frontend saves `{credentialId, alg, sub, email, createdAt}` to IndexedDB — this local metadata is
   what lets CIBA start without hitting the server first (§2.4).

**Disabling** is local-only, matching the reference: "Remove from this browser" just deletes the
IndexedDB key — no server call. True revocation happens separately if the user visits Leafy Pay's own
credentials page (a link, not a flow we build). Either way, no local credential → next entry falls
back to §2.2.

### 2.4 Every subsequent app open — auto-selected, no prompt

1. Frontend checks IndexedDB for a stored credential (`hasCredential()`).
2. **Credential present** → run CIBA automatically while the FaceID animation plays, no button:
   - `POST backend/auth/ciba/start {login_hint_token}` — an opaque base64url `{sub}` built from the
     locally-stored metadata, not a raw email; backend relays to Leafy Pay's `bc-authorize` →
     `{auth_req_id, interval, expires_in}`.
   - Frontend fetches the challenge (`GET backend/auth/ciba/challenge?auth_req_id=`), signs it
     locally with the enrolled key.
   - `POST backend/auth/ciba/approve {auth_req_id, credentialId, signature}` — session-less relay to
     Leafy Pay; the signature *is* the authentication.
   - Frontend polls `POST backend/auth/ciba/poll {auth_req_id}` on the reference's interval until
     `status: 'done'` — that's when the backend has redeemed the `ciba` grant and set the session
     cookie. `pending`/`slow_down` → keep polling; `denied`/`expired` → surface as a failed animation.
   - If `approve` comes back 401/400 (credential revoked at Leafy Pay), delete the local credential
     and fall back to step 3 below.
3. **No credential** → redirect straight to `GET backend/auth/login` (§2.2) — no landing screen, no
   button, same as a first-time visit.

The animation covers this round trip for real — pad/extend it to match actual latency rather than a
fixed timer.

### 2.5 Session (cookie)

One encrypted, stateless, httpOnly cookie (AES-256-GCM): `{accessToken, refreshToken, expiresAt,
grantedScopes, sub, name, email}`. No Atlas session store. `maxAge = 24h`. Refreshed silently on a 401
via `grant_type=refresh_token`; when the cookie itself expires, re-auth follows §2.4's same logic.

## 3. Deployment topology

ObjectBox runs in both environments, identically. Only the LLM backend differs:

| | Local dev (`docker compose up`) | Deployed (Kubernetes) |
|---|---|---|
| Containers | frontend, backend, local-store, objectbox-sync-server | same |
| Offline mode | Real ObjectBox writes + on-device vector search | same |
| LLM | Ollama (local container) | Grove Gateway (managed) |

`leafy-local-store` + `objectbox-sync-server` is a single shared instance always — one simulated
"device," not per-session.

## 4. Containers

`leafy-local-store` is **C++** (`objectbox-c`), not Python — Python's ObjectBox SDK has no Sync
support, Go lacks vector search; C++ is the only SDK with both. Mirrors `voice-car-assistant-v2`:
ObjectBox behind a small C++ HTTP service, `SYNC_ENABLED` entities with an HNSW-indexed vector
property, an `obx::Sync` client to `objectbox-sync-server`, which bridges straight to Atlas via its
built-in MongoDB connector — no custom reconciliation code.

| Container | Stack | Responsibility | Runs in |
|---|---|---|---|
| `leafy-wallet-frontend` | Next.js, LangGraph.js, Zustand | UI, agent routing | Both |
| `leafy-wallet-backend` | FastAPI, pymongo, MCP server | Leafy Pay OAuth client, Atlas Vector Search, MCP tools, Grove Gateway client | Both |
| `leafy-local-store` | C++ (`objectbox-c`) | On-device store + vector search, ObjectBox Sync client, calls Ollama when offline | Both |
| `objectbox-sync-server` | `objectboxio/sync-server-trial` | Bridges ObjectBox → Atlas | Both |
| `ollama` | Ollama, `Qwen2.5:7b` | Local inference | Local dev only |

No Next.js API routes or Server Actions. `next.config.js` `rewrites()` proxy `/api/v1/*` and
`/local/v1/*` to the real services, keeping the browser same-origin so the httpOnly session cookie
survives the `fetch` (the alternative, `SameSite=None; Secure`, needs HTTPS everywhere).

## 5. Data models

### 5.1 Atlas (`leafy-wallet-db`) — enrichment only

References Leafy Pay records by instance reference; never copies their PII or ledger.

```jsonc
// walletContacts — display cache over a Leafy Pay beneficiary
{
  "_id": "uuid",
  "ownerPartyRef": "uuid",                     // Leafy Wallet user (OAuth `sub`)
  "counterpartyArrangementReference": "uuid",  // Leafy Pay's beneficiary reference
  "counterpartyLabel": "string",               // display name, cached from Leafy Pay
  "counterpartyLookupType": "phone | email",
  "counterpartyLookupHint": "string",          // masked hint, e.g. "a***@domain.com"
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}

// walletTransactions — enrichment over a Leafy Pay P2P transfer
{
  "_id": "uuid",
  "leafyPayTransferReference": "uuid",
  "ownerPartyRef": "uuid",
  "counterpartyArrangementReference": "uuid",
  "amount": { "value": 20.00, "currency": "EUR" },
  "note": "string | null",                     // same string sent to Leafy Pay, max 140 chars
  "noteEmbedding": "vector<float> | null",      // for the AI assistant's semantic search
  "direction": "sent | received",
  "leafyPayStatus": "pending | settled | failed | exception",
  "localSyncStatus": "local_pending | synced",  // offline-originated sends only
  "createdAt": "ISODate",
  "settledAt": "ISODate | null"
}
```

Vector index: `walletTransactions.noteEmbedding` only — contacts have no free text to embed.

### 5.2 ObjectBox entities (`leafy-local-store`, C++)

```cpp
struct LocalContact {
    int64_t id;
    std::string counterparty_arrangement_reference;
    std::string display_name;
    int64_t cached_at;
};
// SYNC_ENABLED → syncs to walletContacts via the Sync Server's MongoDB bridge.

struct LocalTransaction {
    int64_t id;
    std::string local_id;      // client UUID, assigned before sync
    std::string counterparty_arrangement_reference;
    double amount;
    std::string currency;
    std::string note;
    std::vector<float> note_embedding;  // HNSW, cosine
    std::string status;         // pending_sync | synced | failed
    int64_t created_at;
};

struct LocalWalletSnapshot {
    int64_t id;
    double balance;
    std::string currency;
    int64_t last_refreshed_at;
};
// Singleton row: read-modify-write on updates to preserve ObjectBox/Sync's syncClock.
```

## 6. API contracts

### 6.1 `leafy-wallet-backend`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/auth/login` | Starts SSO: authorization_code + PKCE, redirects to Leafy Pay's `/auth/authorize` (§2.2) |
| `GET` | `/api/v1/auth/callback` | Exchanges the code, sets the session cookie, redirects into the app |
| `GET` | `/api/v1/auth/me` | Decrypts session cookie → `{sub, name, email}` |
| `POST` | `/api/v1/auth/enroll/challenge` | Session-gated relay to Leafy Pay, Bearer = session's OAuth access token (§2.3) |
| `POST` | `/api/v1/auth/enroll` | Session-gated relay; forwards `{challenge, publicKeyPem, alg, signature, credentialId, authenticatorMetadata?}` |
| `POST` | `/api/v1/auth/ciba/start` | `{login_hint_token}` → relays to Leafy Pay `bc-authorize` → `{auth_req_id, interval, expires_in}` |
| `GET` | `/api/v1/auth/ciba/challenge?auth_req_id=` | Session-less relay to Leafy Pay's challenge endpoint |
| `POST` | `/api/v1/auth/ciba/approve` | `{auth_req_id, credentialId, signature}` → session-less relay |
| `POST` | `/api/v1/auth/ciba/poll` | `{auth_req_id}` → polls Leafy Pay's `ciba` token grant; on success sets the session cookie, returns `{status: 'done'}` |
| `POST` | `/api/v1/auth/logout` | Clears the cookie, best-effort revokes the refresh token |
| `GET` | `/api/v1/contacts` | Leafy Pay `GET /beneficiaries` merged with `walletContacts` |
| `POST` | `/api/v1/contacts` | `{lookupType, lookupValue, label?}` → Leafy Pay `POST /beneficiaries` (resolves *and* registers in one call) |
| `DELETE` | `/api/v1/contacts/{counterpartyArrangementReference}` | Leafy Pay `DELETE /beneficiaries/{ref}` |
| `GET` | `/api/v1/transactions` | Leafy Pay `GET /transactions` merged with our notes/status |
| `POST` | `/api/v1/transactions/send` | `{counterpartyArrangementReference, amount, note?}` → Leafy Pay `POST /beneficiaries/{ref}/transfer` (no `fromAccountRef` — Leafy Pay resolves the default account; single-account wallet, nothing to choose) |
| `GET` | `/api/v1/transactions/{id}` | Detail |
| `GET` | `/api/v1/transactions/search?q=` | Vector search over `noteEmbedding` |
| `POST` | `/api/v1/sync/replay` | Replays queued local transactions as real transfers on reconnect |
| `*` | `/mcp` | Tools: `search_transactions`, `send_money`, `get_balance` |

### 6.2 `leafy-local-store`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/local/v1/health` | Liveness |
| `GET` | `/local/v1/wallet` | Cached balance |
| `GET` | `/local/v1/contacts` | Local contacts |
| `POST` | `/local/v1/contacts` | Queue a contact add, reconciled on reconnect |
| `GET` | `/local/v1/transactions` | Local history (cached + pending) |
| `POST` | `/local/v1/transactions/send` | Queue a send (`pending_sync`), embed the note via Ollama |
| `POST` | `/local/v1/sync/flush` | On reconnect: replay queued sends via the backend's `/sync/replay` |

### 6.3 Leafy Pay endpoints we call

One shared capability API for first-party and merchant callers — owner derived from `token.sub`, no
`{sub}` in any path.

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `{PSP}/auth/authorize` | browser redirect | Hosted login page (§2.2) |
| `POST` | `{PSP}/api/v1/auth/enroll/challenge` | Bearer (session's OAuth access token) | |
| `POST` | `{PSP}/api/v1/auth/enroll` | Bearer (session's OAuth access token) | Registers the device key |
| `POST` | `{PSP}/api/v1/auth/bc-authorize` | client_secret_basic | `{login_hint_token}` → `auth_req_id` |
| `GET` | `{PSP}/api/v1/auth/bc-authorize/{authReqId}` | none | Returns the challenge |
| `POST` | `{PSP}/api/v1/auth/bc-authorize/{authReqId}/approve` | assertion | Signature is the auth |
| `POST` | `{PSP}/api/v1/auth/token` | client_secret_basic | `authorization_code` (+PKCE), `ciba`, or `refresh_token` |
| `GET` | `{PSP}/api/v1/beneficiaries` | Bearer, scope `read:beneficiaries` | List |
| `POST` | `{PSP}/api/v1/beneficiaries` | scope `write:beneficiaries` | Resolve + register in one call; anti-enumeration |
| `DELETE` | `{PSP}/api/v1/beneficiaries/{ref}` | scope `write:beneficiaries` | |
| `POST` | `{PSP}/api/v1/beneficiaries/{ref}/transfer` | scope `write:transfers` | `{amount, note?}` → `{transferReference, status, ...}` |
| `GET` | `{PSP}/api/v1/accounts` | scope `read:accounts` | Masked IBAN only |
| `GET` | `{PSP}/api/v1/transactions` | scope `read:transactions` | Merchant-isolated history |
| `GET` | `{PSP}/api/v1/gateway/transfers/{ref}/status` | scope `read:transactions` | Backs the polling in §8 |

Every OAuth-channel route enforces subject binding server-side — no way to act on the wrong user.

## 7. Frontend integration

- No Next.js API routes/Server Actions — `rewrites()` proxy to the real backends, same-origin.
- `lib/api-client.js`: picks `/local/v1` or `/api/v1` based on `isSimulatedOffline`; every call uses
  `credentials: 'include'`.
- Session lives entirely in the httpOnly cookie. The only thing the frontend holds itself is the
  enrolled WebCrypto private key (IndexedDB, non-extractable).
- `leafy-local-store` calls carry no auth — trusted local/cluster-internal service.

## 8. Key flows

**First-time login**: `GET auth/login` → redirect to Leafy Pay's hosted login → `GET auth/callback` →
session cookie set → lands in Profile.

**Enable passwordless (opt-in, once, from Profile)**: frontend generates a local key → `POST
auth/enroll/challenge` (Bearer = session's OAuth token) → frontend signs it → `POST auth/enroll` →
frontend saves credential metadata to IndexedDB.

**Every app open after that**: frontend checks IndexedDB for a credential — present → `ciba/start
{login_hint_token}` while the FaceID animation plays → frontend fetches + signs the challenge →
`ciba/approve` → frontend polls `ciba/poll` until `status: 'done'` (session cookie now set). Not
present (or `approve` reports the credential revoked) → straight to `auth/login` (SSO), no prompt.

**Add contact**: `POST contacts` → Leafy Pay `POST /beneficiaries` (resolves + registers) → enrichment
doc written → merged result returned.

**Send money (online)**: `POST transactions/send` → Leafy Pay `POST /beneficiaries/{ref}/transfer` →
enrichment doc written. If the result is `pending`, frontend polls `GET transactions/{id}` every ~2s
for ~15s until terminal. Polling over a webhook: webhooks need Leafy Pay to reach a public URL, which
doesn't exist in local dev, and wouldn't remove the need to notify the browser anyway. `internal_ledger`
transfers are likely terminal immediately, so this window may rarely trigger — confirm once on staging.

**Send money (offline)**: `leafy-local-store` writes a pending local transaction, embeds the note via
Ollama, shows optimistically. No Leafy Pay call — offline means unreachable, by definition.

**Reconnect** — two independent things:
1. The Sync Server's MongoDB bridge flushes ObjectBox → Atlas automatically (config, not code).
2. `leafy-local-store` calls `sync/replay`; the backend replays each queued send as a real transfer.

Don't conflate these — "ObjectBox synced" ≠ "money sent." Money only moves via step 2, whenever
reconnect happens (offline duration doesn't matter, nothing polls while disconnected).

**AI chat (online)**: LangGraph.js → backend's MCP tools → Grove Gateway/Ollama for inference, Atlas
Vector Search for `search_transactions`, Leafy Pay for `send_money`.

**AI chat (offline)**: LangGraph.js → `leafy-local-store`'s tools → local vector search + Ollama.
