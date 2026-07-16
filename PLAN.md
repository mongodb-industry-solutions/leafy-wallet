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

**Corp gate:** the staging PSP sits behind MongoDB corp SSO, which answers un-cookied server-side calls
with its HTML login page. A copied session cookie in `PSP_DEV_COOKIE` gets through it. Set only in the
gitignored `.env.local` (never in the image, never in `environment/*.yaml`), so deployed inside the corp
network there's no gate and nothing to send.

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

**`leafy-local-store` (`:8090`, mirrors the backend's surface):** `/local/v1/` — `health`,
`transactions` (+ `/search` HNSW vector, `/send`), `contacts`, `requests`, `chats` (+ `/{id}/messages`),
`accounts` (local-only balance cache, never synced).

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
  movement), then deletes the local record — that delete propagates through Sync, leaving the enrichment
  `sendMoney` wrote (with the real reference) as the only copy.
- **Settlement:** only Leafy Pay knows a transfer settled, so the send flow polls the tx list and writes
  `leafyPayStatus: settled` back to Atlas; Sync carries it to the device. The online read also reconciles
  any enrichment still marked pending against a completed transfer, since settling can outlast the poll.
- **AI chat:** see §5.

## 5. AI chat — plan

**Where it runs.** LangGraph.js in the frontend's **server** layer (`/api/chat` Route Handler), not the
browser: the session cookie is httpOnly and Leafy Pay is server-side only. Inference is the `ollama`
container.

**Why there's only one graph.** Offline is a simulated toggle — the BFF, backend, local store and Ollama
are all containers that stay reachable. So `isOnline` is *an argument to the tools*, not a second graph:
each tool already picks its source. Nothing about the graph changes when the connection drops.

```
browser ──POST /api/chat {chatId, message, isOnline}──▶ Route Handler (:3000)
                                                          ├─ load history ──┐
                                                          └─ LangGraph.js   │
                                                               ├─ chat model ──▶ ollama:11434
                                                               └─ tools (isOnline)
                                                                    │         │
                              online  ──▶ Leafy Pay ∥ backend :8000 (Atlas: wallet* + chats) ◀┤
                              offline ──▶ leafy-local-store :8090 (ObjectBox: same shapes) ◀──┘
                                                    ▲
                                  objectbox-sync-server bridges the two
```

**Tools — all exist already and are connection-aware:**

| Tool | Action | Online | Offline |
|---|---|---|---|
| `get_balance` | `getAccounts` | Leafy Pay | device cache |
| `list_contacts` | `getContacts` | Leafy Pay ∥ Atlas | ObjectBox |
| `list_transactions` | `getTransactions` | Leafy Pay ∥ Atlas | ObjectBox |
| `search_transactions` | **new** `searchTransactions` | `/wallet-transactions/search` ($vectorSearch) | `/local/v1/transactions/search` (HNSW) |
| `send_money` | `sendMoney` | real transfer | `local_pending`, replayed |
| `request_money` | `createRequest` | Atlas | ObjectBox → Sync |

Both search endpoints already exist and embed the query with `nomic-embed-text` — the only new code is
one Server Action that picks between them.

### 5.1 Persistence — history per user

`chats`/`chatMessages` exist on both sides (Atlas `:8000`, device `/local/v1/chats`) and sync like every
other collection. Offline, ObjectBox is the only store — a chat written there syncs up on reconnect with
no replay (a record, not money). Two changes are needed first:

- **`chats` needs `ownerPartyRef`.** It has none today — Atlas *or* ObjectBox — and `list_chats` has no
  owner filter, so every user would read every other user's history. Same scoping the wallet collections
  already use (`ownerPartyRef` = the session `sub`).
- **`chatMessages` needs a store-independent join key.** Today the two write paths disagree: Atlas stores
  `chatId` as the chat's `_id` (string) and never writes `localId`, while ObjectBox stores `chatId` as an
  int64 pointing at `localId`. Both land in the same collection, so an online chat is unreachable offline
  and an offline message is unreachable online. Same fix as `requestReference`: mint a **`chatReference`**
  (uuid) on the chat and have messages carry it. `localId` then has no purpose — it exists only because
  Sync drops the PK — and can be retired once both paths agree.

ObjectBox ids (append-only; retire, never reuse): `chats.ownerPartyRef` = 7 (`7003000000000007`),
`chats.chatReference` = 8 (`…008`), `lastPropertyId` → 8. `chatMessages.chatReference` = 7
(`7004000000000007`), retire `chatId` (`…002`), `lastPropertyId` → 7. Mirror all of it in
`objectbox-model.json`.

Message rows are the durable record; the **context** sent to the model is derived from them per turn.

| | Online | Offline |
|---|---|---|
| list/create chats | `GET/POST /api/v1/chats?ownerPartyRef=` | `/local/v1/chats` |
| append/read messages | `/api/v1/chat-messages?chatId=` | `/local/v1/chats/{id}/messages` |

Same shape as the wallet actions: one connection-aware Server Action per operation, no second code path.
A chat started offline syncs up on reconnect on its own — it's a record, not money, so it needs no replay.

### 5.2 Context per turn

1. Load the active chat's messages (source per `isOnline`).
2. Build the graph state: system prompt + contact list (small, so inline — see below) + prior turns + the
   new message.
3. Run the graph; persist the user turn and the assistant turn as they resolve.

**Context budget is the constraint.** Ollama defaults to `num_ctx=4096` here (it sizes from VRAM, and the
container reports none). System prompt + contacts + tool results eat that fast, so: set `num_ctx`
explicitly, keep a **rolling window** of recent turns, and summarize older ones into a single note rather
than replaying the whole thread. Long-chat behavior is a design problem before it is a code problem.

### 5.3 Build order
1. **Chat model in Ollama** — the blocker. Only `nomic-embed-text` (embeddings) is pulled today; there is
   no chat LLM. Needs a tool-calling model added to `ollama-pull`.
2. **`ownerPartyRef` on `chats`** — backend schema + owner filter, ObjectBox property 7 + local-store
   filter, both models kept byte-consistent.
3. **`searchTransactions`** Server Action + `LocalStoreClient.searchLocalTransactions`.
4. **Chat Server Actions** — `listChats`/`createChat`/`listMessages`/`appendMessage`, connection-aware.
5. **`/api/chat`** Route Handler: LangGraph + tool bindings + context assembly, streaming the reply.
6. **`useAiChat`** onto it, replacing the `wallet-data.js` mock.

### 5.4 MCP server — read-only by construction

`backend/mcp_server/` exposes `search_transactions` and `get_contacts` to an **external** LLM (Claude
Desktop). It is a second consumer of the same data, not part of the in-app chat path.

**It cannot be the write path.** The backend has no Leafy Pay client, token, or OAuth config, and by
design never calls it — the user's access token lives in the frontend's encrypted session cookie and
never leaves that server. An MCP `create_transaction` could therefore only write an Atlas enrichment
doc: a transaction that looks real and moved no money. Balances are the same story (Leafy Pay owns them).
So `send_money` / `get_balance` stay frontend Server Actions; MCP stays read-only over Atlas.

Making MCP write would mean forwarding the OAuth token to the backend — a redesign that moves the trust
boundary, not a new tool.

**Worth adding** (all Atlas-reachable, read-only): `get_requests` (inbox/outbox), `list_transactions`
(plain list; `search_transactions` only does semantic), `get_balance`-shaped data is **not** addable.

### 5.5 Embeddings — what exists, what's missing

Only `walletTransactions.noteEmbedding` is embedded today (Atlas `$vectorSearch` + ObjectBox HNSW, both
via `nomic-embed-text`). Missing:

| Collection | Field | Verdict |
|---|---|---|
| `chatMessages` | `textEmbedding` | **Worth it.** With `num_ctx=4096`, retrieving the few relevant past turns beats replaying a rolling window — RAG over the user's own history is what makes long chats work here. |
| `walletContacts` | `labelEmbedding` | **Low value.** The diagram's "semantic contact lookup". Cosine on names doesn't answer "my sister", and substring already handles "jul" → Julia. Only worth it for typo tolerance. |
| `walletRequests` | `noteEmbedding` | **Low value.** Few rows, and they're already listed by digest. |

Each addition is the same shape as `noteEmbedding`: embed on write in the backend *and* in the C++ store,
add a `FloatVector` property (append-only id) + HNSW index in both models, and an Atlas vector index via
`scripts/create_vector_index.py`.

**Constraints to design around:**
- **Ollama in Docker on macOS is CPU-only** — no Metal passthrough, and the container sees ~7.8 GB, not
  the host's 16 GB. A 7B at Q4 fits (~4.7 GB) but generates slowly. Model choice is a quality/latency
  trade, not a memory one.
- **Contact resolution should not use vector search.** Embedding aliases does *not* answer "send to my
  sister": cosine similarity between "my sister" and "Julia Santos" is noise unless the alias itself says
  so. Contacts are few — pass the list into the prompt and let the model choose. Cheaper, and it actually
  works.
- **`send_money` moves real money.** Tool calls must land on the existing confirm step, never execute
  straight from a model decision.
- **Money only moves through Leafy Pay.** Atlas is enrichment; a write there is a record, not a payment.
  Anything that "creates a transaction" without a Leafy Pay transfer is a fake.

## 6. Status / next
**Done (merged):** auth + corp-gate cookie; backend enrichment + vector search; read layer (Leafy Pay ∥
Atlas); client cache / skeletons / UX; add/remove contacts (addable identities in
`LEAFY_PAY_TEST_USERS.md`); source-account picker; settlement polling + write-back + reconcile-on-read;
insufficient-funds guard; received-money notifications; name resolution in Atlas `walletContacts`;
**payment requests** (`walletRequests` + blind index — create/pay/decline, with a confirm step and
one-shot resolution); **offline** — `walletRequests` in ObjectBox (entity 6), `counterpartyLookupDigest`
on `walletContacts`, offline reads for accounts/contacts/transactions/requests, send buffering +
reconnect replay, request raise/decline; Docker runs the whole stack.

**Still mocked** (`wallet-data.js`): AI chat only — see §5.

**Known gaps:**
- **Received transfers show "Leafy Pay user"** — needs `initiatorName` on the OAuth `/transactions` rows
  (Leafy Pay change; no PR from us).
- **Phone contacts can't be sent requests** — no phone claim in `userinfo` to digest, so the target could
  never derive the same value. Sending to them works.
- **Sarah Chen and Michael Obi have no payout account** in Leafy Pay's seed data — they can't receive
  money at all, by any route.
- **Intermittent 409 flake** on the local store's one-shot request resolution (~1 in 5–8 scripted runs;
  repo tests stable). Unreproduced in isolation; it guards against paying one request twice.

**Next:** AI chat (§5), starting with a chat model in `ollama-pull`.
