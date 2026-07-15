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

## 1. Auth — ✅ Done (merged to main)

SSO login, passwordless enrollment, FaceID/CIBA return, and single sign-out are implemented in the Next
app. Code: `src/lib/auth/{env,session,oauth,actions,authenticator}.js` and the route handlers
`src/app/api/auth/{login,callback,logout}`; wired via `useAuthGate`, `LoginScreen`,
`FaceIdEntry`/`useCibaLogin`, and `ProfileScreen`/`usePasswordless`.

Config in `frontend/.env.local` (gitignored, not `NEXT_PUBLIC_`): `CLIENT_ID`, `CLIENT_SECRET`,
`PSP_BASE_URL` (**API/backend** host), `PSP_FRONTEND_URL` (**frontend** host), `SESSION_SECRET`,
`APP_BASE_URL`, `REDIRECT_URI`. Leafy Pay splits auth across two hosts: the **frontend** host serves the
browser pages `authorize` + `logout` (built directly from `PSP_FRONTEND_URL`, so starting login needs no
server-side call); the **backend** host serves discovery + token/jwks/userinfo/revoke + the business API
(resolved via `PSP_BASE_URL/.well-known/openid-configuration` at callback/refresh time). Session cookie:
encrypted httpOnly AES-256-GCM `{accessToken, refreshToken, expiresAt, grantedScopes, sub, name, email}`.

OAuth client: grant types `authorization_code` / `refresh_token` / `ciba`; 8 scopes
(`openid profile email read:beneficiaries write:beneficiaries write:transfers read:accounts
read:transactions`); `require_pkce`; `redirect_uris=http://localhost:3000/api/auth/callback`; demo user
`amara.okafor@back.es`.

**Known blocker (infra, not code):** the deployed staging host sits behind MongoDB corp SSO
(`login.corp.mongodb.com`), which only browsers pass. The server-side token exchange can't cross it from
a dev laptop, so end-to-end login isn't yet runnable locally. Unblock via `kubectl port-forward` to the
backend, a corp service token/cookie, or a local Leafy Pay. The code is complete and works once the API
is reachable server-side.

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

### 2.3 Leafy Pay read entities (source of truth — `sec-fsi-pci-dss` docs/technical-spec.md §1.17)
Fields the read layer maps (list responses are `{ results, total, page, limit }`):
- **Accounts** `GET /api/v1/accounts` → `payoutAccountArrangement` (SD-66): `payoutAccountInstanceReference`,
  `payoutAccountAlias`/`payoutAccountBankName`, `payoutAccountCurrency`, `payoutAccountIsDefault`,
  `payoutAccountMaskedIban` (raw IBAN stripped in list views), `payoutAccountBalance.availableAmount`.
- **Beneficiaries** `GET /api/v1/beneficiaries` → `counterpartyArrangement` (SD-54):
  `counterpartyArrangementReference`, `counterpartyLabel`, `counterpartyLookupType` (phone|email),
  `counterpartyLookupHint` (masked), `counterpartyArrangementStatus`.
- **Transactions** `GET /api/v1/transactions` → `paymentExecutionProcedure` (SD-65):
  `paymentExecutionInstanceReference`, `beneficiaryArrangementReference` (→ beneficiary),
  `beneficiaryName`/`destinationAccountMasked`, `grossAmount`, `currency`, `paymentExecutionStatus`,
  `paymentExecutionRemittanceInformation` (the P2P note), `completedAt`/`initiatedAt`.

## 3. API contracts

### 3.1 Frontend auth (Next app) — see §1 code layout
Route Handlers `GET /api/auth/login`, `GET /api/auth/callback`; Server Actions `me`, `logout`,
`enrollChallenge`, `enroll`, `cibaStart`, `cibaChallenge`, `cibaApprove`, `cibaPoll`.

### 3.2 Backend (FastAPI) — enrichment/AI only, scoped by `ownerPartyRef` (OAuth `sub`)
Implemented on main. Notes auto-embedded via Ollama on create; queried by `ownerPartyRef`.
| Method | Path | Purpose |
|---|---|---|
| `GET`/`POST` | `/api/v1/wallet-contacts` | List (`?ownerPartyRef=`) / create `walletContacts` |
| `GET`/`PATCH`/`DELETE` | `/api/v1/wallet-contacts/{id}` | Get / update / remove |
| `GET`/`POST` | `/api/v1/wallet-transactions` | List (`?ownerPartyRef=&direction=&leafyPayStatus=`) / create (auto-embeds note) |
| `GET`/`PATCH`/`DELETE` | `/api/v1/wallet-transactions/{id}` | Get / update / remove |
| `GET` | `/api/v1/wallet-transactions/search?q=&ownerPartyRef=` | Vector search over `noteEmbedding` |

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

## 5. Status / next

- **Done:** Auth (§1), merged to main. Backend enrichment layer (§3.2), on main.
- **Done (corp gate):** server-side calls to the gated staging PSP pass via `PSP_DEV_COOKIE` (a copied
  corp session), read **only when `NODE_ENV !== 'production'`** and inert on Mongo infra.
- **Done (reads):** read data layer, field-mapped from docs/technical-spec.md §1.17 (§2.3). Pattern:
  read Leafy Pay (base, source of truth) **in parallel with** its Atlas enrichment, merged.
  `src/lib/psp/PspClient.js` (server-only, Bearer + refresh-on-401), `src/lib/backend/enrichment.js`
  (Atlas note/embedding), Server Actions `src/lib/wallet/actions.js`
  (`getAccounts`/`getContacts`/`getTransactions`), `src/lib/wallet/format.js`. `getTransactions` merges
  the Atlas note by `leafyPayTransferReference` (Leafy Pay `paymentExecutionRemittanceInformation` is the
  fallback). Home / People / Activity render real data. `getContacts` reads Leafy Pay only (the Atlas
  `walletContacts` is the offline replica).
- **Done (send write):** `sendMoney` — Leafy Pay `POST /beneficiaries/{ref}/transfer` in parallel with
  the Atlas note write-back (`createTransactionEnrichment`, embedded by Ollama). Send flow wired to real
  balance + real contacts + real submit (loading/error). Profile linked-account IBAN reads real accounts.
- **Done (data flow / UX):** `src/lib/wallet/WalletDataProvider.jsx` — client cache shared across tabs
  (fetch once per login, event-driven revalidation: `refresh()` after a write, auto-refresh on
  reconnect). Skeleton loading states, horizontal account carousel on Home, logout returns to the app
  (no PSP front-channel).
- **Done (add/remove contacts):** `addContact` resolves a registered Leafy Pay email/phone into a saved
  beneficiary (`POST /beneficiaries`) ∥ `walletContacts` write-back, erroring cleanly if none matches;
  `removeContact` (`DELETE /beneficiaries/{ref}` + replica cleanup). People tab has add (`+` sheet) and
  per-row remove. Addable identities: see `LEAFY_PAY_TEST_USERS.md`.
- **Still mocked** (`wallet-data.js`): AI chat only (chart data, sample queries, intent parsing,
  action-card draft) + a `WalletApp` user fallback.

**Next:**
1. AI chat — `useAiChat` over the real Server Actions + `wallet-transactions/search` (Atlas vector
   search). Light intent routing first; LangGraph.js as a later phase.
2. Send: let the user pick a **source account** — contract confirmed, the transfer accepts an optional
   `fromAccountRef` (OAuth resolves the default when omitted), so this is now a pure frontend feature.
3. Offline: `leafy-local-store` + ObjectBox sync (§2.2, §3.3); the send flow's offline "saved" branch and
   the provider's reconnect-refresh are the placeholders.
