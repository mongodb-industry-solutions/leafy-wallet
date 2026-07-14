# Leafy Wallet — Architecture Plan

Leafy Wallet is a merchant on **Leafy Pay** (external BIAN PSP). Users are existing Leafy Pay parties.
Contacts = Leafy Pay beneficiaries (SD-54); sends = P2P transfers (SD-65) via merchant OAuth. Atlas is
an **enrichment layer only** (display cache + one embedding field), keyed by Leafy Pay references.

**Component boundaries:**
- **Frontend (Next.js, `:3000`)** — OAuth confidential client / BFF. The only component that calls
  Leafy Pay, always server-side. Also calls the backend and local-store.
- **Backend (FastAPI, `:8000`)** — Atlas enrichment + vector search + AI/MCP. **Never calls Leafy Pay.**
- **`leafy-local-store` (C++)** — on-device store + vector search (offline).
- **`objectbox-sync-server`** — bridges ObjectBox → Atlas.

## 1. Auth (port of `sec-fsi-pci-dss` `merchant/` reference into the Next app)

Code layout:
- `src/lib/auth/{oauth,session,env}.js` — `server-only`. `client_secret`, token exchange/refresh/CIBA,
  id_token verify, AES-256-GCM cookie.
- `src/lib/auth/authenticator.js` — browser WebCrypto ES256 key in IndexedDB + signing.
- `src/lib/auth/actions.js` — Server Actions: `me`, `logout`, `enrollChallenge`, `enroll`,
  `cibaStart`, `cibaChallenge`, `cibaApprove`, `cibaPoll`.
- Route Handlers: `GET /api/auth/login`, `GET /api/auth/callback`.
- `src/lib/psp/PspClient.js` — `server-only` Leafy Pay client (Bearer from session, refresh-on-401).

### 1.1 OAuth client (already provisioned on Leafy Pay)
- `grant_types`: `authorization_code`, `refresh_token`, `urn:openid:params:grant-type:ciba`
- `scopes`: `openid profile email read:beneficiaries write:beneficiaries write:transfers read:accounts read:transactions`
- `require_pkce: true`
- `redirect_uris`: `http://localhost:3000/api/auth/callback`
- User: `amara.okafor@back.es`

### 1.2 Frontend server env
Values live in `frontend/.env.local` (gitignored, not `NEXT_PUBLIC_`) — deployed-staging URLs are kept
out of this repo. Keys: `CLIENT_ID`, `CLIENT_SECRET`, `PSP_BASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`,
`REDIRECT_URI`. Authorize/token/jwks/userinfo/revoke resolved from
`PSP_BASE_URL/.well-known/openid-configuration`.

### 1.3 First login (SSO)
1. `GET /api/auth/login` → PKCE + state/nonce, set login-state cookie, redirect to authorize endpoint.
2. User logs in on Leafy Pay.
3. `GET /api/auth/callback?code&state` → verify state, exchange code (`client_secret_basic`), verify
   id_token, set session cookie, redirect into app.

### 1.4 Enable passwordless (Profile)
1. WebCrypto ES256 keypair, private key non-extractable in IndexedDB.
2. `enrollChallenge()` (Bearer from session) → sign locally → `enroll({challenge, publicKeyPem, alg,
   signature, credentialId, authenticatorMetadata?})`.
3. Save `{credentialId, alg, sub, email, createdAt}` to IndexedDB.

Disable = delete IndexedDB key (local only, no server call).

### 1.5 Return visit
1. `hasCredential()` in IndexedDB?
2. **Yes** → FaceID animation while CIBA runs: `cibaStart({login_hint_token})` → `cibaChallenge` →
   sign → `cibaApprove` → poll `cibaPoll` until `done` (session cookie set). On approve 401/400 →
   delete credential, fall to step 3.
3. **No** → `GET /api/auth/login`.

### 1.6 Session cookie
Encrypted httpOnly AES-256-GCM, set by the Next app: `{accessToken, refreshToken, expiresAt,
grantedScopes, sub, name, email}`. Refresh silently on 401 via `refresh_token`.

## 2. Data models

### 2.1 Atlas (`leafy-wallet-db`) — enrichment only
```jsonc
// walletContacts
{ "_id": "uuid", "ownerPartyRef": "uuid", "counterpartyArrangementReference": "uuid",
  "counterpartyLabel": "string", "counterpartyLookupType": "phone | email",
  "counterpartyLookupHint": "string", "createdAt": "ISODate", "updatedAt": "ISODate" }

// walletTransactions
{ "_id": "uuid", "leafyPayTransferReference": "uuid", "ownerPartyRef": "uuid",
  "counterpartyArrangementReference": "uuid", "amount": { "value": 20.00, "currency": "EUR" },
  "note": "string | null", "noteEmbedding": "vector<float> | null", "direction": "sent | received",
  "leafyPayStatus": "pending | settled | failed | exception",
  "localSyncStatus": "local_pending | synced", "createdAt": "ISODate", "settledAt": "ISODate | null" }
```
Vector index: `walletTransactions.noteEmbedding`.

### 2.2 ObjectBox (`leafy-local-store`, C++)
```cpp
struct LocalContact { int64_t id; std::string counterparty_arrangement_reference, display_name; int64_t cached_at; }; // SYNC_ENABLED
struct LocalTransaction { int64_t id; std::string local_id, counterparty_arrangement_reference; double amount; std::string currency, note; std::vector<float> note_embedding; std::string status; int64_t created_at; };
struct LocalWalletSnapshot { int64_t id; double balance; std::string currency; int64_t last_refreshed_at; }; // singleton
```

## 3. API contracts

### 3.1 Frontend auth (Next app) — see §1 code layout
Route Handlers `GET /api/auth/login`, `GET /api/auth/callback`; Server Actions `me`, `logout`,
`enrollChallenge`, `enroll`, `cibaStart`, `cibaChallenge`, `cibaApprove`, `cibaPoll`.

### 3.2 Backend (FastAPI) — enrichment/AI only, scoped by `owner` (OAuth `sub`)
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/enrichment/contacts?owner=` | `walletContacts` for owner |
| `POST` | `/api/v1/enrichment/contacts` | Upsert cache doc |
| `DELETE` | `/api/v1/enrichment/contacts/{ref}` | Remove cache doc |
| `GET` | `/api/v1/enrichment/transactions?owner=` | Notes/status/embeddings |
| `POST` | `/api/v1/enrichment/transactions` | Write enrichment doc |
| `GET` | `/api/v1/enrichment/transactions/search?owner=&q=` | Vector search over `noteEmbedding` |
| `POST` | `/api/v1/embeddings` | Embed a note (Grove Gateway/Ollama) |
| `*` | `/mcp` | Agent tool `search_transactions` (vector search) |

### 3.3 `leafy-local-store`
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/local/v1/health` | Liveness |
| `GET` | `/local/v1/wallet` | Cached balance |
| `GET`/`POST` | `/local/v1/contacts` | Local contacts / queue add |
| `GET` | `/local/v1/transactions` | Local history |
| `POST` | `/local/v1/transactions/send` | Queue send (`pending_sync`) + embed note |
| `POST` | `/local/v1/sync/flush` | Replay queued sends on reconnect |

### 3.4 Leafy Pay endpoints the frontend calls (server-side)
| Method | Path | Auth |
|---|---|---|
| `GET` | `{PSP}/api/v1/auth/authorize` | browser redirect |
| `POST` | `{PSP}/api/v1/auth/token` | client_secret_basic |
| `POST` | `{PSP}/api/v1/auth/enroll/challenge` | Bearer |
| `POST` | `{PSP}/api/v1/auth/enroll` | Bearer |
| `POST` | `{PSP}/api/v1/auth/bc-authorize` | client_secret_basic |
| `GET` | `{PSP}/api/v1/auth/bc-authorize/{authReqId}` | none |
| `POST` | `{PSP}/api/v1/auth/bc-authorize/{authReqId}/approve` | assertion |
| `POST` | `{PSP}/api/v1/auth/revoke` | client_secret_basic |
| `GET` | `{PSP}/api/v1/beneficiaries` | Bearer `read:beneficiaries` |
| `POST` | `{PSP}/api/v1/beneficiaries` | Bearer `write:beneficiaries` |
| `DELETE` | `{PSP}/api/v1/beneficiaries/{ref}` | Bearer `write:beneficiaries` |
| `POST` | `{PSP}/api/v1/beneficiaries/{ref}/transfer` | Bearer `write:transfers` |
| `GET` | `{PSP}/api/v1/accounts` | Bearer `read:accounts` |
| `GET` | `{PSP}/api/v1/transactions` | Bearer `read:transactions` |
| `GET` | `{PSP}/api/v1/gateway/transfers/{ref}/status` | Bearer `read:transactions` |

## 4. Key flows
- **Add contact**: PspClient → Leafy Pay `POST /beneficiaries` → backend `POST /enrichment/contacts` →
  merge for display.
- **Send (online)**: PspClient → `POST /beneficiaries/{ref}/transfer` → backend `POST /embeddings` +
  `POST /enrichment/transactions`. If `pending`, poll `gateway/transfers/{ref}/status` ~2s for ~15s.
- **Send (offline)**: local-store writes `pending_sync` + embeds via Ollama.
- **Reconnect**: (1) Sync Server flushes ObjectBox → Atlas; (2) frontend replays queued sends as real
  Leafy Pay transfers via PspClient.
- **AI (online)**: LangGraph.js → `search_transactions` via backend MCP; `send_money`/`get_balance`
  via frontend PspClient. Inference via Grove Gateway/Ollama.
- **AI (offline)**: LangGraph.js → local-store tools + Ollama.

## 5. Scope now
Auth only (§1): login, session, passwordless enroll, FaceID/CIBA return, logout. Contacts/transactions/
send/AI stay mocked (`wallet-data.js`) until wired later.
