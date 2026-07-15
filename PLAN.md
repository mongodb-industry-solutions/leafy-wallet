# Leafy Wallet — Architecture Plan

Leafy Wallet is a merchant on **Leafy Pay** (external BIAN PSP); users are Leafy Pay parties. Contacts =
beneficiaries (SD-54), sends = P2P transfers (SD-65), via merchant OAuth. **Atlas is an
enrichment/replica layer only** (a display note + one embedding, keyed by Leafy Pay references).
**ObjectBox** is the single on-device store — offline read cache *and* write buffer — kept in sync with
Atlas by the ObjectBox Sync Server. There is no separate offline queue: queued sends are just ObjectBox
records with a `local_pending` status.

**Components:**
- **Frontend (Next.js `:3000`)** — OAuth confidential client / BFF; the only caller of Leafy Pay (always
  server-side). Also calls the backend and (offline) local-store.
- **Backend (FastAPI `:8000`)** — Atlas enrichment + vector search + AI. **Never calls Leafy Pay.**
- **`leafy-local-store` (C++/ObjectBox)** — on-device store + offline vector search.
- **`objectbox-sync-server`** — bidirectional ObjectBox ⇄ Atlas bridge.

## 1. Auth — ✅ done
SSO login, passwordless (CIBA/FaceID) enrollment + return, single sign-out. Code: `src/lib/auth/*` +
`src/app/api/auth/{login,callback,logout}`; UI via `useAuthGate`, `LoginScreen`, `FaceIdEntry`,
`ProfileScreen`. No OIDC discovery — endpoints built from `PSP_BASE_URL`; browser `authorize`/`logout`
on `PSP_FRONTEND_URL`. Encrypted httpOnly session cookie. Config in gitignored `frontend/.env.local`.

Merchant OAuth: `authorization_code`/`refresh_token`/`ciba`; PKCE; scopes `openid profile email
read/write:beneficiaries write:transfers read:accounts read:transactions`;
`redirect_uri=http://localhost:3000/api/auth/callback`. Demo user `amara.okafor@back.es`.

**Corp gate (dev only):** the staging PSP sits behind MongoDB corp SSO. A copied session cookie in
`PSP_DEV_COOKIE` (read only when `NODE_ENV !== 'production'`, inert in prod) lets server-side calls
through.

## 2. Data models
**Atlas mirrors ObjectBox** — identical shapes (the Sync bridge requires it), so `walletTransactions` is
*not* minimal by design: offline the local record must stand alone.

- `walletContacts`: `{ ownerPartyRef, counterpartyArrangementReference, counterpartyLabel,
  counterpartyLookupType, counterpartyLookupHint, _id, createdAt, updatedAt }`
- `walletTransactions`: `{ ownerPartyRef, leafyPayTransferReference, counterpartyArrangementReference,
  amount (flat float), currency, note, noteEmbedding, direction, leafyPayStatus, localSyncStatus, _id,
  createdAt, settledAt }` — vector index on `noteEmbedding`.

**Only `note` + `counterpartyArrangementReference` are read back from Atlas**; everything else is read
live from Leafy Pay. A P2P transaction from Leafy Pay carries **no** `beneficiaryName` and no counterparty
ref, so the enrichment's `counterpartyArrangementReference` is the only link from a sent tx to its saved
contact (alias + avatar).

**Leafy Pay (source of truth):** `GET /accounts` (payoutAccountArrangement), `/beneficiaries`
(counterpartyArrangement), `/transactions` (paymentExecution; the note comes back as `concept`).

## 3. API contracts
**Frontend Server Actions** (`src/lib/wallet/actions.js`): `getAccounts`/`getContacts`/`getTransactions`,
`addContact`/`removeContact`, `sendMoney`, `getTransferStatus`. Auth in `src/lib/auth/actions.js`.

**Backend (FastAPI, scoped by `ownerPartyRef`):**
- `GET/POST /api/v1/wallet-contacts` (+ `/{id}` GET/PATCH/DELETE)
- `GET/POST /api/v1/wallet-transactions` (+ `/{id}` GET/PATCH/DELETE)
- `GET /api/v1/wallet-transactions/search?q=&ownerPartyRef=` (vector search)

**`leafy-local-store`:** `/local/v1/{health, wallet, contacts, transactions, sync/flush}`.

**Leafy Pay (frontend, server-side, Bearer):** `/beneficiaries` GET/POST/DELETE,
`/beneficiaries/{ref}/transfer` POST, `/accounts` GET, `/transactions` GET. Settlement is read from the
tx list — the `/gateway/transfers/{ref}/status` endpoint is session-only (not OAuth).

## 4. Key flows
- **Read (online):** transactions merge **Leafy Pay ∥ Atlas** in parallel (`Promise.all`, by
  `leafyPayTransferReference`); accounts + contacts are Leafy Pay only.
- **Add contact:** PspClient `POST /beneficiaries` ∥ backend `POST /wallet-contacts`.
- **Send (online):** PspClient `POST /beneficiaries/{ref}/transfer` ∥ backend `POST /wallet-transactions`
  (note embedded by Ollama, non-fatal). Settlement polled via the tx list until `completed`.
- **Offline:** reads + writes hit ObjectBox (the only local store); a queued send is a `LocalTransaction`
  with `local_pending` + a temp ref.
- **Reconnect — two independent syncs:** (1) ObjectBox ⇄ Atlas via the Sync Server (data replica,
  automatic); (2) the app replays ObjectBox's `local_pending` sends to Leafy Pay via PspClient (money
  movement), then rewrites each record's `leafyPayTransferReference` to the real one.
- **AI:** LangGraph.js — online: `search_transactions` (backend) + `send_money`/`get_balance` (PspClient);
  offline: local-store tools. Inference via Ollama.

## 5. Status / next
**Done (merged):** auth; backend enrichment + vector search; corp-gate dev cookie; read layer (Leafy Pay
∥ Atlas); send + note write-back; client cache / skeletons / UX; add/remove contacts (addable identities
in `LEAFY_PAY_TEST_USERS.md`).

**Done (branch `feat/send-flow-completion`):** source-account picker (`fromAccountRef`); settlement status
(poll tx list, Pending → Completed); insufficient-funds guard; received-money notifications (bell derived
from inbound transfers, per-user "seen" marker).

**Still mocked** (`wallet-data.js`): AI chat only.

**Next:** 1) AI chat over the real actions + vector search — light routing first, LangGraph later (gated
on the teammate's save-chats backend). 2) Offline: `leafy-local-store` + ObjectBox sync + reconnect
replay.
