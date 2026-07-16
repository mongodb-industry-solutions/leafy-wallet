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
  counterpartyLookupType, counterpartyLookupHint, counterpartyLookupDigest, _id, createdAt, updatedAt }`
- `walletTransactions`: `{ ownerPartyRef, leafyPayTransferReference, counterpartyArrangementReference,
  amount (flat float), currency, note, noteEmbedding, direction, leafyPayStatus, localSyncStatus, _id,
  createdAt, settledAt }` — vector index on `noteEmbedding`.
- `walletRequests`: `{ requestReference, requesterPartyRef, requesterName, requesterDigest, targetDigest,
  amount, currency, note, status (pending|paid|declined|cancelled), leafyPayTransferReference, _id,
  createdAt, resolvedAt }` — Leafy Pay has no concept of a request; see §4.

**Name resolution lives in Atlas.** `walletContacts` is the **alias directory** — the name source of
truth (user-owned, offline-available, chat-searchable). Leafy Pay supplies only the obscured data (refs,
masked hints, amounts, status); its beneficiaries are **backfilled into `walletContacts` on read** so the
directory stays complete. From `walletTransactions` we read back the `note` + `counterpartyArrangementReference`
(a P2P transaction from Leafy Pay carries no counterparty ref or name of its own, so that link is the only
way to resolve a *sent* tx's contact).

**`*Digest` is a blind index** — a keyed HMAC of the normalized email (`LOOKUP_DIGEST_KEY`), mirroring the
PSP's own `partyMobilePhoneNumberDigest`. It exists because Leafy Pay gives a user no usable identifier for
anyone else: `counterpartyPartyReference` is withheld by design and arrangement refs are minted per-owner,
so A's reference for B means nothing to B. But A typed B's email to add them and B's session carries the
same email, so its digest is the one value both derive. We store the digest, never the address. Phone
contacts have none (no phone claim to match), so they can't be sent requests.

**Received transfers show "Leafy Pay user".** The sender *is* known to the PSP (`initiatorPartyReference`),
and it already resolves an `initiatorName` for exactly this purpose — but only on a session-gated endpoint;
the OAuth `/transactions` list simply omits it. A serializer change on their side, not a design limit.

**Leafy Pay (source of truth):** `GET /accounts` (payoutAccountArrangement), `/beneficiaries`
(counterpartyArrangement), `/transactions` (paymentExecution; the note comes back as `concept`).

## 3. API contracts
**Frontend Server Actions** (`src/lib/wallet/actions.js`): `getAccounts`/`getContacts`/`getTransactions`,
`addContact`/`removeContact`, `sendMoney`, `getTransferStatus`, `createRequest`/`getRequests`/
`payRequest`/`resolveRequest`. Auth in `src/lib/auth/actions.js`.

**Backend (FastAPI, scoped by `ownerPartyRef`):**
- `GET/POST /api/v1/wallet-contacts` (+ `/{id}` GET/PATCH/DELETE)
- `GET/POST /api/v1/wallet-transactions` (+ `/{id}` GET/PATCH/DELETE)
- `GET /api/v1/wallet-transactions/search?q=&ownerPartyRef=` (vector search)
- `GET/POST /api/v1/wallet-requests` (+ `/{id}` GET/PATCH/DELETE) — listed by `targetDigest` (inbox) or
  `requesterPartyRef` (outbox); PATCH to a terminal status is one-shot (409 on replay).

**`leafy-local-store`:** `/local/v1/{health, wallet, contacts, transactions, sync/flush}`.

**Leafy Pay (frontend, server-side, Bearer):** `/beneficiaries` GET/POST/DELETE,
`/beneficiaries/{ref}/transfer` POST, `/accounts` GET, `/transactions` GET. Settlement is read from the
tx list — the `/gateway/transfers/{ref}/status` endpoint is session-only (not OAuth).

## 4. Key flows
- **Read (online):** `Promise.all` of Leafy Pay + Atlas. **Names resolve from Atlas `walletContacts`**
  (aliases, backfilled from Leafy Pay beneficiaries); Leafy Pay supplies refs/masks/amounts/status.
  Transactions merge by `leafyPayTransferReference`. Received transfers → "Leafy Pay user".
- **Add contact:** PspClient `POST /beneficiaries` ∥ backend `POST /wallet-contacts` (alias required).
  An email lookup is the only moment we hold the address — the digest is derived here, the address dropped.
- **Send (online):** PspClient `POST /beneficiaries/{ref}/transfer` ∥ backend `POST /wallet-transactions`
  (note embedded by Ollama, non-fatal). Settlement polled via the tx list until `completed`.
- **Request:** Atlas-only — Leafy Pay is never called, because nothing moves until it's paid. The
  requester writes a `walletRequests` doc addressed to the contact's `counterpartyLookupDigest`; the
  target finds it by digesting their own session email, and it surfaces in the existing bell. **Paying
  is an ordinary send:** match `requesterDigest` against the payer's own contacts → arrangement ref →
  `sendMoney` → mark the request `paid`. The requester must already be a contact of the payer — Leafy
  Pay only accepts a transfer against an arrangement the sender owns, and creating one needs their
  email, which is the anti-enumeration rule working as intended.
- **Offline:** reads + writes hit ObjectBox (the only local store); a queued send is a `LocalTransaction`
  with `local_pending` + a temp ref. The connection state is passed into each Server Action, which is
  what picks the source. Balances are the exception: their cache entity is local-only, so the online
  read writes them through to the device. **A request needs no replay** — Leafy Pay has no part in one,
  so Sync carrying it to Atlas *is* the delivery. Paying does need the network.
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
from inbound transfers, per-user "seen" marker); **name resolution moved to Atlas `walletContacts`**
(backfilled from Leafy Pay) with required aliases and non-empty name/note on every row; enrichment writes
are now required (surface an error if the backend is down, no silent best-effort); **payment requests**
(`walletRequests` + blind index, real create/pay/decline — no longer mocked).

**Done (branch, offline):** `walletRequests` entity in ObjectBox + the local store (entity 6) and
`counterpartyLookupDigest` on `walletContacts` (without it a contact syncing down from Atlas loses its
digest and can't be sent a request); `/local/v1/requests` CRUD; offline reads for accounts/contacts/
transactions/requests; offline send buffering + reconnect replay; offline request raise/decline.

**Still mocked** (`wallet-data.js`): AI chat only.

**Waiting on Leafy Pay (no PR from us):** `initiatorName` + `beneficiaryArrangementReference` missing from
the OAuth `/transactions` rows (would fix inbound sender names and drop our Atlas join for sent rows).

**Next:** 1) AI chat — add `walletContacts` alias embedding + a `/wallet-contacts/search` endpoint so
names resolve semantically ("send to my sister"); then `useAiChat` over the real actions + vector search
(light routing first, LangGraph later; gated on the teammate's save-chats backend). 2) Offline:
`leafy-local-store` + ObjectBox sync + reconnect replay.
