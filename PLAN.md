# Leafy Wallet — Architecture Plan

Status: **draft, for scoping** — working plan to finalize scope, data models, and endpoints before
implementation starts. Sections marked **OPEN** are blocked on information or a decision we don't
have yet.

## 1. What Leafy Wallet is

A P2P wallet demo. Leafy Wallet is registered as a **merchant** on Leafy Pay (an external,
BIAN-compliant PSP — see `sec-fsi-pci-dss` wiki + `develop` branch source). Leafy Wallet's *users* are
existing Leafy Pay **parties/customers** (Luis, Julia, Amara, Carlos, …) associated with that
merchant — Leafy Wallet does not create users, only references ones that already exist on Leafy Pay.
All money movement is **peer-to-peer** (no buy-from-a-store flow): a "contact" in Leafy Wallet is a
Leafy Pay **beneficiary** (`counterpartyArrangement`, BIAN SD-54), and a "send money" is a Leafy Pay
**P2P transfer to that beneficiary** (BIAN SD-65), executed *on behalf of* the logged-in user via
merchant OAuth, never as a direct card/merchant charge.

Leafy Wallet does not duplicate Leafy Pay's storage or ledger. It owns a separate, smaller Atlas
cluster used purely as an **enrichment/intelligence layer** — labels, notes, and embeddings for
Atlas Vector Search — referencing Leafy Pay's records by their instance references, never copying
their PII or encrypted fields.

## 2. Identity model — Leafy Wallet is an OAuth client of Leafy Pay, full stop

There is no separate Leafy Wallet identity system. Logging into Leafy Wallet *is* logging into Leafy
Pay via OAuth2 authorization_code + PKCE — the same flow the `sec-fsi-pci-dss` repo's reference
`merchant/` app implements (`merchant/src/lib/oauth.ts`,
`merchant/src/app/api/auth/{login,callback}/route.ts`). We're copying that pattern into
`leafy-wallet-backend` (FastAPI) instead of Next.js route handlers, since the frontend calls the
backend directly (§4) rather than proxying through Next.js API routes.

Leafy Wallet is registered on Leafy Pay as an **OAuth confidential client** (a row in Leafy Pay's
`merchantAgreementProcedure` collection, under `merchantOAuthClient` — same shape as the seeded
"Espresso Works" demo client in `backend/data/merchants.json` on that repo). This gives us:

- `oauthClientId` / `oauthClientSecretHash` (client_secret is shown once, server-only, never in the
  browser)
- `oauthRedirectUris` (must include our callback URL)
- `oauthScopes` — the scopes our client is *allowed* to request: `read:beneficiaries`,
  `write:beneficiaries`, `write:transfers`, `read:accounts`, `read:transactions`, plus OIDC
  `openid profile email`
- `oauthRequirePkce: true` (we're a browser-driven flow, PKCE is mandatory)
- `oauthTokenLifetimeSeconds` (default 3600 = 1h access token), `oauthRefreshTokenLifetimeDays`
  (default 30d refresh token)

**OPEN (action item)**: we need the maintainer to provision this OAuth client for Leafy Wallet
specifically (client_id + client_secret + our redirect URI registered), the same way "Espresso Works"
was seeded for the reference app. This is a config handoff, not something we can self-serve.

### 2.1 The flow, end to end

1. Browser hits Leafy Wallet → not logged in → redirect to `leafy-wallet-backend`'s
   `GET /api/v1/auth/login`.
2. Backend generates PKCE verifier/challenge + `state`/`nonce`, stashes them in a short-lived
   encrypted httpOnly cookie, redirects the browser to Leafy Pay's **authorize page**
   (`PSP_BASE_URL/auth/authorize`, human login+consent UI — not an API call).
3. User logs in with their **Leafy Pay** email/password on Leafy Pay's own page. Leafy Pay redirects
   back to our `GET /api/v1/auth/callback?code=...&state=...`.
4. Backend validates `state`, exchanges `code` (+ PKCE verifier) for tokens at Leafy Pay's
   `POST /auth/token` (confidential client, HTTP Basic client_secret auth), verifies the `id_token`
   (RS256, JWKS), and gets `{access_token, refresh_token, id_token, expires_in, scope}`.
5. Backend sets **one encrypted, stateless, httpOnly session cookie** (AES-256-GCM, same design as
   the reference app's `ew_session` cookie) containing `{accessToken, refreshToken, expiresAt,
   grantedScopes, sub, name, email}`. There's no server-side session store in Atlas — the cookie *is*
   the session.
6. Every subsequent request from the browser to `leafy-wallet-backend` just needs
   `credentials: 'include'` — no `Authorization: Bearer` header from the browser at all. The backend
   decrypts its own cookie, and internally attaches `Authorization: Bearer <leafyPayAccessToken>` to
   whatever it calls on Leafy Pay. **The browser never sees the Leafy Pay token.**
7. On a Leafy Pay 401 (expired access token), the backend transparently refreshes once via
   `POST /auth/token` (grant_type=refresh_token) and retries — same as `PspClient.ts`'s
   `ensureFreshToken()`/`doRefresh()`. This is invisible to the frontend.
8. If the **refresh token** itself is dead (30 days, or revoked) or our **own session cookie**
   expires, the backend returns 401 to the frontend, which redirects to `/api/v1/auth/login` again —
   full re-login, same UX as first load.

### 2.2 Session TTL

Reuses the exact cookie mechanism from step 5 above — the same `sessionCookieOpts()` pattern the
reference `merchant/` app already ships (theirs is hardcoded to `maxAge: 60 * 60 * 8`, 8h). Not a new
layer, just one config number set differently: `maxAge = 24h`, independent of Leafy Pay's 1h
access-token TTL (refreshed silently underneath it, per step 7) and its 30-day refresh-token TTL.
Rationale: someone opens the deployed demo, authenticates once, and shouldn't have to re-auth again
within that sitting; capping at 24h just bounds how long a forgotten-open tab stays authenticated.
When the cookie expires, the user goes through step 1–4 again — indistinguishable from a first visit.

## 3. Deployment topology

ObjectBox runs in both environments, identically. The only thing that differs between local dev and
deployed is which LLM backend answers the AI assistant:

| | Local full-stack dev (`docker compose up`) | Deployed (Kubernetes) |
|---|---|---|
| Containers running | frontend, backend, local-store, objectbox-sync-server | frontend, backend, local-store, objectbox-sync-server |
| "Offline" toggle does | Real, identical in both environments: writes to ObjectBox via `leafy-local-store`, real on-device vector search | same |
| LLM calls | Always Ollama (local container, `Qwen2.5:7b`) | Always Grove Gateway (managed, external) |

`ollama` is a container only in the local-dev compose file; there's no `ollama` container in the
Kubernetes deployment — Grove Gateway is an external managed service we call over HTTPS, not
something we run a pod for.

`leafy-local-store` + `objectbox-sync-server` is a single shared instance always, in both
environments — one simulated "device," not spun up per-session or per-visitor.

## 4. Containers

`leafy-local-store`'s ObjectBox-owning core is **C++** (`objectbox-c`/`objectbox-cpp`), not Python —
the Python ObjectBox SDK has no Sync support at all, and Go lacks vector search, so C++ is the only
SDK that gives us both Sync and HNSW vector search in the same process. This mirrors
`voice-car-assistant-v2`'s pattern: ObjectBox lives behind a small C++ HTTP service
(`search-service`/`vss-telemetry-service` there), entities defined with `OBXEntityFlags_SYNC_ENABLED`
+ an HNSW-indexed `FloatVector` property, an `obx::Sync` client connecting out to
`objectbox-sync-server`.

We also reuse that repo's approach of pointing the official Sync Server directly at Atlas with its
built-in MongoDB bridge (`objectboxio/sync-server-trial`, flags `--mongo-url`/`--mongo-db`) instead of
writing custom reconciliation code — `SYNC_ENABLED` entities just appear as Mongo collections with
matching names automatically (see §8 "Reconnect").

| Container | Stack | Responsibility | Runs in |
|---|---|---|---|
| `leafy-wallet-frontend` | Next.js (App Router), LangGraph.js, Zustand | UI, agent routing (local vs cloud tools based on `isSimulatedOffline`) | Both |
| `leafy-wallet-backend` | FastAPI, Pydantic, pymongo, MCP server | Leafy Pay OAuth client (holds tokens server-side, refreshes them), our Atlas Vector Search, MCP tools for the online agent branch, Grove Gateway client | Both |
| `leafy-local-store` | C++ (`objectbox-c`/`objectbox-cpp`), small HTTP server | Owns the on-device ObjectBox store (contacts, pending transactions, balance snapshot) + on-device HNSW vector search, ObjectBox Sync **client**; calls Ollama directly when offline | Both |
| `objectbox-sync-server` | Official `objectboxio/sync-server-trial` image, built-in MongoDB bridge | Bridges `leafy-local-store`'s ObjectBox data straight to our Atlas cluster — no custom reconciliation code for the cache side | Both — Kubernetes-hosted in deployed, Docker Compose in local dev |
| `ollama` | Ollama, `Qwen2.5:7b` | Local LLM inference | Local dev only (Grove Gateway replaces it in Kubernetes) |

No Next.js API routes or Server Actions for calling these services — the frontend calls
`leafy-wallet-backend` and `leafy-local-store` directly with `credentials: 'include'`. `next.config.js`
`rewrites()` proxy `/api/v1/*` and `/local/v1/*` to the real backend URLs, so the browser's requests
are same-origin from its perspective. This is config, not code — no handler function runs, no extra
hop of business logic — and it's what lets the httpOnly session cookie set by `leafy-wallet-backend`
survive a `fetch` from the frontend's origin (the alternative, `SameSite=None; Secure`, needs HTTPS
everywhere including local dev).

## 5. Data models

### 5.1 Our Atlas cluster (`leafy-wallet-db`) — the enrichment layer

None of this is Leafy Pay's data. Everything here references Leafy Pay records by their real
instance references and stores only what Leafy Wallet adds on top: labels, notes, embeddings. There
is no session collection — see §2.1, the session lives in an encrypted cookie, not Atlas.

```jsonc
// walletContacts — our enrichment on top of a Leafy Pay beneficiary (counterpartyArrangement)
{
  "_id": "uuid",
  "ownerPartyRef": "uuid",                        // the Leafy Wallet user (OAuth `sub`) who saved this contact
  "counterpartyArrangementReference": "uuid",     // real field name, from Leafy Pay's beneficiary record
  "counterpartyLabel": "string",                  // cached from Leafy Pay for fast render (their own label field)
  "counterpartyLookupType": "phone | email",
  "counterpartyLookupHint": "string",             // masked hint Leafy Pay returns, e.g. "a***@domain.com" — never the raw value
  "nickname": "string | null",                    // our own label, e.g. "Roommate" (independent of counterpartyLabel)
  "notes": "string | null",
  "notesEmbedding": "vector<float>",              // built from nickname + notes
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}

// walletTransactions — our enrichment on top of a Leafy Pay P2P transfer execution
{
  "_id": "uuid",
  "leafyPayTransferReference": "uuid",            // real field: `transferReference` from the send response
  "ownerPartyRef": "uuid",
  "counterpartyArrangementReference": "uuid",     // which saved beneficiary this went to/came from
  "amount": { "value": 20.00, "currency": "EUR" },
  "note": "string | null",                        // same string sent as Leafy Pay's `note` (max 140 chars) — embedded on our side too
  "noteEmbedding": "vector<float> | null",
  "direction": "sent | received",
  "leafyPayStatus": "pending | settled | failed | exception", // updated via short client-side poll, see §8
  "localSyncStatus": "local_pending | synced",    // only meaningful for offline-originated sends
  "createdAt": "ISODate",
  "settledAt": "ISODate | null"
}
```

Atlas Vector Search indexes: `walletContacts.notesEmbedding`, `walletTransactions.noteEmbedding`.

### 5.2 ObjectBox local entities (`leafy-local-store`, C++, runs in both environments)

Illustrative only — following `voice-car-assistant-v2`'s `search-service/schema.obx.hpp` pattern
(programmatic model + a hand-written `obx::Property<>` struct, `SYNC_ENABLED` flag, HNSW index on
the vector property):

```cpp
struct LocalContact {
    int64_t id;
    std::string counterparty_arrangement_reference;  // matches Leafy Pay's real field name
    std::string display_name;                          // cached counterpartyLabel
    std::string nickname;
    std::string notes;
    std::vector<float> notes_embedding;  // HNSW-indexed, cosine distance
    int64_t cached_at;
};
// obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED) → syncs straight to
// leafy-wallet-db's walletContacts collection via the Sync Server's MongoDB bridge.

struct LocalTransaction {
    int64_t id;
    std::string local_id;      // client-generated UUID, assigned before any sync
    std::string counterparty_arrangement_reference;
    double amount;
    std::string currency;
    std::string note;
    std::vector<float> note_embedding;  // HNSW-indexed, cosine distance
    std::string status;         // pending_sync | synced | failed
    int64_t created_at;
};

struct LocalWalletSnapshot {
    int64_t id;
    double balance;
    std::string currency;
    int64_t last_refreshed_at;
};
// Singleton-per-wallet row: read-modify-write on updates (not blind overwrite) to preserve
// ObjectBox/Sync's internal syncClock bookkeeping — same pattern as that repo's PowertrainState.
```

## 6. API contracts

### 6.1 `leafy-wallet-backend` (calls Leafy Pay's real merchant-portal API — see §6.3)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/auth/login` | Starts OAuth authorization_code + PKCE, redirects to Leafy Pay's `/auth/authorize` |
| `GET` | `/api/v1/auth/callback` | Exchanges `code` for tokens, verifies `id_token`, sets our encrypted session cookie, redirects to the app |
| `POST` | `/api/v1/auth/logout` | Clears our session cookie, best-effort revokes the Leafy Pay refresh token |
| `GET` | `/api/v1/auth/me` | Decrypts our session cookie, returns `{sub, name, email}` — no Leafy Pay call needed |
| `GET` | `/api/v1/contacts` | List: calls Leafy Pay `GET /api/v1/merchant/beneficiaries/{sub}`, merges with our `walletContacts` enrichment docs |
| `POST` | `/api/v1/contacts` | `{lookupType, lookupValue, label?}` → calls Leafy Pay `POST /api/v1/merchant/beneficiaries/{sub}/lookup` (this call both resolves *and* registers the beneficiary — it's not a two-step preview+confirm), then writes our enrichment doc |
| `DELETE` | `/api/v1/contacts/{counterpartyArrangementReference}` | Calls Leafy Pay `DELETE /api/v1/merchant/beneficiaries/{sub}/{token}`, removes our enrichment doc |
| `GET` | `/api/v1/contacts/search?q=` | Vector search over our `notesEmbedding` (Leafy Pay has no notion of this) |
| `GET` | `/api/v1/transactions` | Calls Leafy Pay `GET /api/v1/merchant/transactions/{sub}`, merges with our notes/status |
| `POST` | `/api/v1/transactions/send` | `{counterpartyArrangementReference, amount, note?}` → Leafy Pay `POST /api/v1/merchant/beneficiaries/{sub}/{token}/send` (no `fromAccountRef` — see below), then writes our enrichment doc |
| `GET` | `/api/v1/transactions/{id}` | Detail |
| `GET` | `/api/v1/transactions/search?q=` | Vector search over `noteEmbedding` |
| `POST` | `/api/v1/sync/replay` | Called by `leafy-local-store` on reconnect: replays queued local transactions as real `.../send` calls, returns per-item result |
| `*` | `/mcp` | MCP server (tools: `search_contacts`, `search_transactions`, `send_money`, `get_balance`) for the browser's LangGraph.js agent when online |

**Design choice**: we never expose Leafy Pay's `fromAccountRef` (source payout account) in Leafy
Wallet's UI or API at all. Leafy Pay resolves the sender's default/first-active payout account
server-side when it's omitted (confirmed in `merchantBeneficiary.controller.ts`'s
`resolveSourcePayoutAccountRef`), and Leafy Wallet is a single-account P2P wallet demo, not a
multi-account bank UI — so there's nothing for the user to choose.

### 6.2 `leafy-local-store` (runs everywhere, single-machine/single-tenant per instance)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/local/v1/health` | Liveness |
| `GET` | `/local/v1/wallet` | Cached balance snapshot |
| `GET` | `/local/v1/contacts` | Local contacts |
| `POST` | `/local/v1/contacts` | Add a contact locally (queued; reconciled against the real Leafy Pay beneficiary on reconnect) |
| `GET` | `/local/v1/contacts/search?q=` | On-device vector search |
| `GET` | `/local/v1/transactions` | Local history (cached + pending) |
| `POST` | `/local/v1/transactions/send` | Queue a P2P send (`status=pending_sync`), embed the note via Ollama immediately |
| `POST` | `/local/v1/sync/flush` | Triggered on reconnect: gathers `pending_sync` transactions, calls the backend's `/sync/replay`, updates local status |

### 6.3 Leafy Pay endpoints we actually call (confirmed from `develop` branch source, not guessed)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `{PSP}/.well-known/openid-configuration` | none | OIDC discovery, cached for process lifetime |
| `GET` | `{PSP}/auth/authorize` | browser redirect | human login+consent page, not a JSON API |
| `POST` | `{PSP}/auth/token` | HTTP Basic (client_id:client_secret) | `grant_type=authorization_code\|refresh_token` |
| `GET` | `{PSP}/api/v1/auth/userinfo` | Bearer (user token) | OIDC claims per granted scope |
| `GET` | `{PSP}/api/v1/merchant/beneficiaries/{sub}` | Bearer (user token, on-behalf-of, sub-bound), scope `read:beneficiaries` | list, paginated |
| `POST` | `{PSP}/api/v1/merchant/beneficiaries/{sub}/lookup` | scope `write:beneficiaries` | `{lookupType: 'phone'\|'email', lookupValue, label?}`; anti-enumeration — always `{found:false}`-shaped on no match/dup |
| `DELETE` | `{PSP}/api/v1/merchant/beneficiaries/{sub}/{token}` | scope `write:beneficiaries` | |
| `POST` | `{PSP}/api/v1/merchant/beneficiaries/{sub}/{token}/send` | scope `write:transfers` | `{amount, currency?, fromAccountRef?, note?}` → `{transferReference, amount, currency, status, failureReason?}` |
| `GET` | `{PSP}/api/v1/merchant/accounts/{sub}` | scope `read:accounts` | masked IBAN only |
| `GET` | `{PSP}/api/v1/merchant/transactions/{sub}` | scope `read:transactions` | payment execution history |

`{sub}` is the OAuth subject == the user's `partyRef`; every one of these routes enforces
**sub-binding** (the token's `sub` must equal the `{sub}` in the path) server-side on Leafy Pay, so
there's no way for our backend to accidentally act on behalf of the wrong user even if it tried.

## 7. Frontend integration

- No Next.js API routes or Server Actions. `next.config.js` `rewrites()` proxy `/api/v1/*` →
  `leafy-wallet-backend` and `/local/v1/*` → `leafy-local-store`, so both are same-origin from the
  browser (needed for the httpOnly session cookie to ride along automatically — see §4).
- `lib/api-client.js` (illustrative): reads `isSimulatedOffline` from Zustand, picks which rewritten
  base path to hit (`/local/v1` offline, `/api/v1` online); every call site (`fetch`) goes through
  it with `credentials: 'include'`, no manual header wiring.
- Leafy Wallet's session: entirely the httpOnly cookie set by `/api/v1/auth/callback`. The frontend
  never holds a token of any kind — not in memory, not in `localStorage`.
- `leafy-local-store` calls carry no auth — it's a trusted local/cluster-internal service, not
  directly reachable from outside.

## 8. Key flows

**Login**: browser → `GET backend/auth/login` → redirect to Leafy Pay's authorize page → user logs
in on Leafy Pay → Leafy Pay redirects to `GET backend/auth/callback` → backend exchanges code,
verifies id_token, sets the encrypted session cookie → browser lands back in the app already
authenticated, no token ever touched by frontend JS.

**Add contact (online)**: browser → `POST backend/contacts {lookupType, lookupValue, label?}` →
backend calls Leafy Pay's `/merchant/beneficiaries/{sub}/lookup` (this single call resolves *and*
registers the beneficiary) → backend embeds nickname/notes → writes `walletContacts` doc → returns
merged result.

**Send money (online)**: browser → `POST backend/transactions/send {counterpartyArrangementReference,
amount, note?}` → backend calls Leafy Pay's `/merchant/beneficiaries/{sub}/{token}/send` → on
success, backend writes `walletTransactions` enrichment doc → returns result. Money only ever moves
through this one path.

If the response's `status` is `pending` rather than terminal, the frontend polls
`GET backend/transactions/{id}` every ~2s for a short window (~15s) until it flips to
`settled`/`failed`, then stops. **Chosen over a webhook**: a webhook needs Leafy Pay to reach a
public URL of ours, which works in the deployed Kubernetes environment but not local dev
(`localhost` isn't reachable from Leafy Pay's side without a tunnel) — that would mean two different
mechanisms per environment, cutting against §3's "identical everywhere" principle. It also wouldn't
remove the need for polling anyway: a webhook only updates our own Atlas doc, the browser would still
need to learn about the change via polling or a push channel (SSE/WebSocket) we'd have to build. Given
the `internal_ledger` rail is P2P-within-platform rather than external bank clearing, the `.../send`
response is likely already terminal most of the time, so this polling window may rarely even trigger
— worth confirming once we can hit staging.

**Send money (offline)**: browser → `POST local-store/transactions/send` → `leafy-local-store` writes
a `LocalTransaction(status=pending_sync)`, calls Ollama directly to embed the note, shows
optimistically in UI. **No Leafy Pay call happens** — offline means Leafy Pay is unreachable by
definition, regardless of which environment we're in (§3).

**Reconnect**: two independent things happen —
1. `objectbox-sync-server`'s built-in MongoDB bridge flushes `leafy-local-store`'s `SYNC_ENABLED`
   ObjectBox entities into our Atlas cluster automatically — no custom code, just config. Purely our
   own cache reconciling with our own database.
2. `leafy-local-store` calls `POST backend/sync/replay` with the queued transactions →
   `leafy-wallet-backend` replays each as a **real** `.../send` call to Leafy Pay → results flow back
   → local statuses flip to `synced` or `failed`. This call is synchronous and happens *whenever*
   reconnect occurs — 15 seconds offline or 5 minutes offline makes no difference, since nothing
   polls or times out while disconnected. If a replayed send itself comes back `pending` rather than
   terminal, the same short poll window from the online flow above kicks in at that point, started by
   the reconnect event — not by a timer running since the transaction was originally queued offline.

These two are not the same operation. Don't let anything conflate "ObjectBox synced" with "money
sent" — money only moves via step 2.

**AI chat (online)**: browser's LangGraph.js → `leafy-wallet-backend`'s MCP tools → backend calls
Grove Gateway (deployed) or Ollama (local dev) for inference, calls Atlas Vector Search for
`search_contacts`/`search_transactions`, calls Leafy Pay for `send_money`.

**AI chat (offline)**: browser's LangGraph.js → `leafy-local-store`'s tool endpoints → local ObjectBox
vector search + Ollama directly — Ollama is always the offline inference path, in both environments.

## 9. Open questions / action items

1. **Missing: an OAuth client for Leafy Wallet itself.** Need from the maintainer: an
   `oauthClientId` + `oauthClientSecret` + our redirect URI registered under the Leafy Wallet merchant
   agreement (§2). `amara.okafor@back.es` / `demo-password` is a user login, not this — it doesn't
   substitute for it. Also worth asking for a couple more test users under the merchant.
