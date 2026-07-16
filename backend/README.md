# Leafy Wallet API

Python backend for Leafy Wallet, built with [FastAPI](https://fastapi.tiangolo.com/) and MongoDB Atlas. It stores a display cache of Leafy Pay beneficiaries (`walletContacts`), an enrichment layer over Leafy Pay P2P transfers (`walletTransactions`) including semantic-search embeddings generated locally via [Ollama](https://ollama.com/), and the AI assistant's chat history (`chats`/`chatMessages`). Dependency management is handled by [uv](https://docs.astral.sh/uv/).

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Data Schemas](#data-schemas)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [ObjectBox Offline Sync (PoC)](#objectbox-offline-sync-poc)

## Features

- RESTful CRUD API for `walletContacts` and `walletTransactions`, powered by FastAPI + Pydantic schemas.
- RESTful API for `chats`/`chatMessages` (the AI assistant's conversations), including cascade-delete of a chat's messages.
- MongoDB Atlas persistence via `pymongo`, with a shared connection injected through FastAPI dependencies.
- Automatic semantic-search embedding generation for transaction notes via a local Ollama model, without blocking writes if Ollama is unavailable.
- Semantic search over transaction notes via Atlas Vector Search (`GET /api/v1/wallet-transactions/search`).
- Dependency management with uv ([more info](https://docs.astral.sh/uv/)).

## Prerequisites

Before you begin, ensure you have:

- Python 3.13 (but less than 3.14)
- uv (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))
- A MongoDB Atlas cluster with a database user (Database Access) and your IP allow-listed (Network Access). For `/wallet-transactions/search`, the cluster tier must support [Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-search/) (M10+ dedicated, or Search Nodes/Serverless).
- [Ollama](https://ollama.com/) running locally with the `nomic-embed-text` model pulled; optional, only needed for `noteEmbedding` generation on transactions. Two ways to get this:
  - Native install: `ollama pull nomic-embed-text`, then leave `ollama serve` running.
  - Docker (matches the deployed setup): from the repo root, run `docker compose up -d ollama ollama-pull`. This starts Ollama on `localhost:11434` (published from the container) and pulls the model automatically. Either way, the backend's default `OLLAMA_BASE_URL=http://localhost:11434` works unchanged for local `uvicorn` runs.

## Getting Started

### Backend Setup

1. From the repo root, run:
   ```bash
   make install_uv   # installs uv if you don't have it
   make uv_init       # creates backend/.venv
   make uv_sync       # installs dependencies from uv.lock
   ```
2. Verify that the `.venv` folder was generated inside `backend/`.
3. One-time per Atlas cluster: provision the vector search index backing `/wallet-transactions/search`:
   ```bash
   cd backend
   uv run python scripts/create_vector_index.py
   ```
   This is idempotent,  safe to re-run if the index definition changes.

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string (Connect → Drivers → Python) |
| `DATABASE_NAME` | yes | Database name inside the cluster |
| `APP_NAME` | yes | App name reported to Atlas for connection metrics |
| `ORIGINS` | no | Allowed CORS origin for the frontend (currently informational; CORS is wide open in `main.py`) |
| `OLLAMA_BASE_URL` | no | Defaults to `http://localhost:11434` |
| `OLLAMA_EMBEDDING_MODEL` | no | Defaults to `nomic-embed-text` |

## Running the Application

```bash
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

The API is then available at `http://localhost:8000`. If port 8000 is taken (e.g. by Docker), stop the containers with `make clean` or use a different `--port`.

**Note:** open Swagger/ReDoc using `localhost`, not `0.0.0.0`, browsers will reject the "Try it out" requests against `0.0.0.0` even though the page itself loads fine.

## API Documentation

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- All resource endpoints are namespaced under `/api/v1`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/wallet-contacts` | Create a contact |
| `GET` | `/api/v1/wallet-contacts` | List contacts (optional `ownerPartyRef` filter) |
| `GET` | `/api/v1/wallet-contacts/{id}` | Get a contact by id |
| `PATCH` | `/api/v1/wallet-contacts/{id}` | Partially update a contact |
| `DELETE` | `/api/v1/wallet-contacts/{id}` | Delete a contact |
| `POST` | `/api/v1/wallet-transactions` | Create a transaction (generates `noteEmbedding` via Ollama if `note` is set) |
| `GET` | `/api/v1/wallet-transactions` | List transactions (optional `ownerPartyRef`, `direction`, `leafyPayStatus` filters) |
| `GET` | `/api/v1/wallet-transactions/search` | Semantic search over transaction notes via Atlas Vector Search (`q`, optional `ownerPartyRef`, `limit`) |
| `GET` | `/api/v1/wallet-transactions/{id}` | Get a transaction by id |
| `PATCH` | `/api/v1/wallet-transactions/{id}` | Partially update a transaction (status, settlement, embedding) |
| `DELETE` | `/api/v1/wallet-transactions/{id}` | Delete a transaction |
| `POST` | `/api/v1/chats` | Create a chat conversation |
| `GET` | `/api/v1/chats` | List all chats |
| `GET` | `/api/v1/chats/{id}` | Get a chat by id |
| `PATCH` | `/api/v1/chats/{id}` | Rename a chat |
| `DELETE` | `/api/v1/chats/{id}` | Delete a chat (cascades to its messages) |
| `POST` | `/api/v1/chat-messages` | Create a message (404 if `chatId` doesn't reference an existing chat) |
| `GET` | `/api/v1/chat-messages` | List messages (optional `chatId` filter) |
| `GET` | `/api/v1/chat-messages/{id}` | Get a message by id |
| `DELETE` | `/api/v1/chat-messages/{id}` | Delete a message |

## Data Schemas

Two independent write paths can populate the same Atlas collections: this FastAPI backend
(writes directly), and `leafy-local-store` via the ObjectBox↔MongoDB Sync Server bridge (see
[ObjectBox Offline Sync](#objectbox-offline-sync-poc) below). Documents that arrived through
the sync bridge can carry extra bookkeeping fields that documents this backend writes
directly never have — `syncClock` on `walletContacts`/`walletTransactions`, and `localId` on
`chats`. See [Sync-related fields](#sync-related-fields) below for what those mean, including
why `chats`/`chatMessages` don't have `syncClock` even though the other two collections do.

### Atlas collections

**`walletContacts`** — a display cache of Leafy Pay beneficiaries, keyed by owner.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `ownerPartyRef` | string | Leafy Pay OAuth `sub` |
| `counterpartyArrangementReference` | string | Leafy Pay beneficiary reference |
| `counterpartyLabel` | string | |
| `counterpartyLookupType` | `"phone"` \| `"email"` | |
| `counterpartyLookupHint` | string | masked |
| `createdAt` / `updatedAt` | date | |
| `syncClock` | long | only on documents synced from ObjectBox — see [Sync-related fields](#sync-related-fields) |

**`walletTransactions`** — enrichment layer (note + embedding) over Leafy Pay P2P transfers.
`amount`/`currency` are **flat top-level fields**, not a nested `amount: {value, currency}`
sub-document — deliberate, since the ObjectBox↔Mongo bridge can only write flat fields (see
[ObjectBox Offline Sync](#objectbox-offline-sync-poc)), and the canonical schema was
flattened to match rather than have two shapes coexist in one collection.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `leafyPayTransferReference` | string | Leafy Pay transfer reference |
| `ownerPartyRef` | string | |
| `counterpartyArrangementReference` | string | |
| `amount` | float | flat, not `{value, currency}` |
| `currency` | string | flat |
| `note` | string \| null | max 140 chars |
| `noteEmbedding` | float[768] \| null | generated via Ollama (`nomic-embed-text`) |
| `direction` | `"sent"` \| `"received"` | |
| `leafyPayStatus` | `"pending"` \| `"settled"` \| `"failed"` \| `"exception"` | |
| `localSyncStatus` | `"local_pending"` \| `"synced"` | |
| `createdAt` | date | |
| `settledAt` | date \| null | |
| `syncClock` | long | only on documents synced from ObjectBox — see [Sync-related fields](#sync-related-fields) |

**`chats`** — a conversation in the AI assistant.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `title` | string | |
| `createdAt` / `updatedAt` | date | |
| `localId` | long | only on documents synced from ObjectBox — see [Sync-related fields](#sync-related-fields) |

**`chatMessages`** — a single message within a `chats` conversation. A separate collection
rather than a nested array on `chats`, because ObjectBox has no nested/array attributes and
both write paths need to produce the same shape.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `chatId` | string (FastAPI path) or number (ObjectBox path) | references a `chats` document — see below |
| `role` | `"user"` \| `"assistant"` | |
| `text` | string | |
| `createdAt` | date | |

### ObjectBox entities (`leafy-local-store/local_store_service.cpp`)

Local mirrors of the four Atlas collections above, defined programmatically against the
ObjectBox C API (no `.fbs`/codegen file — see `create_obx_model()`). Every entity has an
internal `id` (`Long`, `OBXPropertyFlags_ID`) that ObjectBox assigns and manages. `LocalContact`
and `LocalTransaction` also still declare a plain `syncClock` `Long` field; `LocalChat` and
`LocalChatMessage` do not (removed — see [Sync-related fields](#sync-related-fields)).

**`LocalChat`**

| Field | Type | Notes |
|---|---|---|
| `id` | Long (PK) | ObjectBox-internal; does **not** survive into Atlas — see below |
| `title` | String | |
| `createdAt` / `updatedAt` | Date | epoch millis in C++, real `ISODate` once synced |
| `localId` | Long | mirrors `id`; this is the field that *does* survive into Atlas — see below |

**`LocalChatMessage`**

| Field | Type | Notes |
|---|---|---|
| `id` | Long (PK) | |
| `chatId` | Long | matches the parent `LocalChat.localId` (and, once synced, `chats.localId`) |
| `role` | String | `"user"` or `"assistant"` |
| `text` | String | |
| `createdAt` | Date | |

**`LocalContact`** / **`LocalTransaction`**: see the struct definitions in
`local_store_service.cpp` — field names and types match `walletContacts`/`walletTransactions`
above 1:1 (that's the whole point of the flattened schema), including still declaring
`syncClock`. Neither has a `localId`-style field, since neither is referenced by another
synced entity the way `chatMessages` references `chats`.

### Sync-related fields

Fields that only ever appear on documents that arrived via the ObjectBox → Atlas bridge, never
on documents this FastAPI backend writes directly:

- **`syncClock`** (`walletContacts`/`walletTransactions` only — removed from `chats`/
  `chatMessages`, see below) — always `0` in every document ever observed. ObjectBox Sync does
  have a genuine, documented "Sync Clock" feature (a hybrid logical clock used for conflict
  resolution — deciding which concurrent offline write wins), but per ObjectBox's docs that's
  opt-in via an explicit `@SyncClock()`-style annotation/flag on the property — this model
  declares `syncClock` as a plain `Long` with no such flag (unlike `id`, which does get the
  dedicated `OBXPropertyFlags_ID` flag). So it was never confirmed to be wired into that
  mechanism, or required by the sync bridge at all — it reads as an inherited convention
  (mirroring a reference implementation per the code comments), not something ever verified to
  be load-bearing. The Sync Server's actual "where did I leave off" bookkeeping for the MongoDB
  bridge lives in its own `__ObjectBox_Metadata` collection in MongoDB, not in a per-document
  field, per ObjectBox's FAQ.

  **Removed from `LocalChat`/`LocalChatMessage` as a deliberate experiment**, and confirmed via
  `test_leafy_local_store_sync.py` (which exercises the real bidirectional bridge, not just the
  local HTTP surface) that both directions of sync still work correctly without it. Scoped to
  just these two entities rather than all four — lower blast radius, since they're the newest
  and least depended-upon. `LocalContact`/`LocalTransaction` still declare it, left untouched
  pending a separate decision once there's been more time to build confidence. See "Removing an
  ObjectBox property..." below for how the removal itself was done.
- **`localId`** (`chats` only) — added specifically because the Sync Server's bridge drops
  an entity's own primary-key field (`id`) when writing to Mongo; Mongo just assigns its own
  `_id` instead (see "A synced entity's own primary-key..." below). Without a second, non-PK
  field mirroring `id`, there'd be no way to join `chatMessages.chatId` back to its parent
  `chats` document once both had synced to Atlas — `localId` is that mirror, set right after
  ObjectBox assigns the real `id` on creation.

## Project Structure

```
backend/
├── main.py                 # FastAPI app, CORS, router mounting
├── config/                 # Static app config (config.json + loader)
├── db/
│   ├── mdb.py               # MongoDBConnector: thin wrapper around pymongo
│   ├── client.py            # Cached get_db() dependency (single shared connection)
│   └── utils.py             # ObjectId parsing / serialization helpers
├── schemas/
│   ├── wallet_contacts.py   # Create / Update / Out Pydantic models
│   ├── wallet_transactions.py
│   ├── chats.py              # Chat conversation schemas
│   ├── chat_messages.py      # Chat message schemas (no Update — immutable)
│   └── registry.py          # collection name -> canonical schema map
├── services/
│   └── ollama.py             # Embedding client for noteEmbedding
├── routers/
│   ├── wallet_contacts.py    # CRUD endpoints
│   ├── wallet_transactions.py  # CRUD + semantic search
│   ├── chats.py               # CRUD, cascade-deletes a chat's messages
│   └── chat_messages.py       # Create / list / get / delete (no PATCH)
├── scripts/
│   └── create_vector_index.py  # Provisions the Atlas Vector Search index (run once per cluster)
└── tests/                    # pytest integration tests (run against Atlas)
```

## Testing

```bash
cd backend
uv run pytest -v
```

Tests run as integration tests directly against MongoDB Atlas using the credentials in `.env`. If Atlas isn't reachable (e.g. no database user configured yet), the whole suite skips cleanly instead of failing. Each test cleans up the documents it creates.

Tests in `test_wallet_transactions_search.py` additionally skip if the vector search index hasn't been provisioned (see `scripts/create_vector_index.py` above), and poll for up to ~60s per assertion since Atlas Search indexes newly written documents asynchronously.

`test_leafy_local_store*.py` (four files: the base one plus `_chats`/`_accounts`/`_sync`) are
**local-only, not part of CI** — they need `leafy-local-store` actually running (see
[ObjectBox Offline Sync](#objectbox-offline-sync-poc) below), and deploying that whole stack
in CI wasn't judged worth it for this PoC. They skip cleanly if the service isn't reachable,
same pattern as the Atlas/Ollama skips above. Most of them create records that sync into the
real Atlas collections, so every test cleans up via `DELETE /local/v1/.../{id}` (which
propagates the deletion through Sync back to Atlas too) rather than leaving test data behind.

`test_leafy_local_store_sync.py` specifically is the one file that verifies the Sync Server
bridge itself is actually moving data — every other file only exercises the local HTTP surface
in isolation (write via `leafy-local-store`, read back via `leafy-local-store`), which would
stay green even if the bridge were completely broken. This one writes via `leafy-local-store`
and reads back directly from Atlas via `pymongo`, and the other direction too (writes directly
to Atlas, reads back via `leafy-local-store`), for every synced entity
(`walletContacts`/`walletTransactions`/`chats`/`chatMessages`), plus a regression check that
`LocalAccountBalance` never shows up in Atlas. Since sync is asynchronous in both directions,
every assertion polls with a timeout (20s, picked empirically) instead of checking immediately
— a timeout here means the bridge didn't do its job in time, which is exactly the failure mode
this file exists to catch.

## ObjectBox Offline Sync (PoC)

This is a proof of concept toward the project's broader *offline-ready mobile wallet*
architecture. The idea: a mobile app should keep working with no network by writing to an
on-device store, then sync those writes to Atlas once connectivity returns. Since this
demo's client is a Next.js web app (no browser SDK exists for ObjectBox's native on-device
store), the on-device piece is simulated by a small standalone service instead of running
inside a real mobile app.

**This lives outside `backend/`**, as two sibling directories at the repo root, because it's
a different stack (C++) with its own build/runtime:

| Directory | Stack | Role |
|---|---|---|
| `leafy-local-store/` | C++ (`objectbox-c` + Sync) | HTTP service simulating the on-device store: accepts writes, embeds `note` via Ollama, persists locally, syncs when connected |
| `objectbox-sync-server/` | `objectboxio/sync-server-trial` (official image) | Bridges ObjectBox ↔ Atlas via its built-in MongoDB connector, no custom reconciliation code |

### How it fits with this backend

Both `leafy-local-store` and this FastAPI backend can write into the **same**
`walletTransactions`, `walletContacts`, `chats`, and `chatMessages` Atlas collections — one
online write path (this API), one offline-capable write path (`leafy-local-store`). For
`walletTransactions`, that's the reasoning behind the flat `amount`/`currency` fields
described in [Data Schemas](#data-schemas): the ObjectBox↔Mongo bridge is generic and can't
produce nested documents, so the schema was flattened to match rather than have two shapes
coexist in one collection. The two paths are otherwise independent — nothing reconciles a
document written by one path against the other, and which path a caller uses for chats is a
frontend decision, not something resolved here.

Not every entity here is meant for Atlas, though: `LocalAccountBalance` (last-known account
balance, cached for offline display) is deliberately **local-only** — no
`OBXEntityFlags_SYNC_ENABLED`, no entry in `objectbox-sync-server/objectbox-model.json`, never
reaches Atlas. A balance is derived, non-authoritative data (Leafy Pay owns the real value, and
the frontend re-fetches it live on every online read), unlike a contact or a transaction note,
so there's no clear benefit to a central Atlas copy — see the struct comment in
`local_store_service.cpp` for the full reasoning. Sync-enabling is opt-in per entity, so this
just means skipping the flag rather than anything unusual.

### Running it locally

```bash
export UID=$(id -u)
export GID=$(id -g)
docker compose up -d objectbox-sync-server leafy-local-store
```

The `user: "${UID:-1000}:${GID:-1000}"` line in the root `docker-compose.yml`'s
`objectbox-sync-server` service matches the container to your host user,  **required**,
because that service bind-mounts `./objectbox-sync-server:/data` and needs to create an
internal subdirectory there for its Mongo sync state. Without a matching UID/GID, that fails
with `Failed to create directory`. The `export`s above must run in the same shell that runs
`docker compose up`. Compose reads `${UID}`/`${GID}` from environment variables at parse
time (most shells don't export these by default), so skipping the `export` silently falls
back to `1000:1000`.

**One-time setup per environment** (each fresh Atlas cluster / each time the sync server's
local state is cleared):
1. Open the Admin UI at `http://localhost:9980` and activate the trial license when prompted.
2. Go to **MongoDB Connector → Full Sync** and click **"Full Import from MongoDB"**. This is
   required before the bridge starts listening for ongoing changes, skipping it means writes
   never leave the sync server (it logs a warning saying exactly this until you do it).

### `leafy-local-store` API (port 8090)

| Method | Path | Description |
|---|---|---|
| `GET` | `/local/v1/health` | Store status + local transaction/contact/chat/message counts |
| `GET` | `/local/v1/transactions` | List locally-stored transactions |
| `GET` | `/local/v1/transactions/search` | Semantic search over local transaction notes — entirely offline, via ObjectBox's own HNSW index (`q`, optional `ownerPartyRef`, `limit`) |
| `POST` | `/local/v1/transactions/send` | Create a transaction locally (embeds `note` via Ollama, syncs to Atlas once connected) |
| `DELETE` | `/local/v1/transactions/{id}` | Delete a local transaction by its ObjectBox id (propagates through Sync to Atlas too) |
| `GET` | `/local/v1/contacts` | List locally-stored contacts |
| `POST` | `/local/v1/contacts` | Queue a contact add locally (reconciled with Leafy Pay on reconnect), syncs to Atlas once connected |
| `GET` | `/local/v1/chats` | List locally-stored chats |
| `POST` | `/local/v1/chats` | Create a chat locally, syncs to Atlas once connected |
| `DELETE` | `/local/v1/chats/{chatId}` | Delete a chat locally (cascades to its messages), syncs to Atlas once connected |
| `GET` | `/local/v1/chats/{chatId}/messages` | List a chat's locally-stored messages |
| `POST` | `/local/v1/chats/{chatId}/messages` | Create a message locally, syncs to Atlas once connected |
| `DELETE` | `/local/v1/chats/{chatId}/messages/{messageId}` | Delete a message locally, syncs to Atlas once connected |
| `DELETE` | `/local/v1/contacts/{id}` | Delete a local contact by its ObjectBox id (propagates through Sync to Atlas too) |
| `GET` | `/local/v1/accounts` | List cached account balances — **local-only, never syncs** |
| `PUT` | `/local/v1/accounts/{accountReference}` | Upsert the cached balance for an account (creates or updates in place) — **local-only** |
| `DELETE` | `/local/v1/accounts/{accountReference}` | Remove a cached balance — **local-only** |

**`GET /local/v1/health`**
```json
// 200
{"status": "healthy", "transaction_count": 3, "contact_count": 1, "chat_count": 2, "chat_message_count": 5, "account_count": 2}
// 500
{"status": "error", "error": "..."}
```

**`GET /local/v1/transactions`**: no request body; returns an array of the same object shape
as the `send` response below (`200`), or `{"error": "..."}` (`500`).

**`GET /local/v1/transactions/search`**: mirrors the backend's `GET /wallet-transactions/search`
(same params: `q` required, `ownerPartyRef`/`limit` optional), but runs entirely offline —
embeds `q` via the local Ollama container, then queries ObjectBox's own HNSW index directly
(no Atlas round trip). **Important difference from the Atlas endpoint**: the returned `score`
is a *distance* (lower = more similar, already sorted nearest-first) — the opposite convention
from Atlas's `$vectorSearch` score (higher = better). `ownerPartyRef` filtering happens
client-side in `local_store_service.cpp` (ObjectBox's `nearestNeighbors` query can't combine
with an equality filter directly), so it over-fetches and filters in code — fine at this
PoC's local scale.
```json
// 200
[
  {
    "id": 1,
    "leafyPayTransferReference": "string",
    "ownerPartyRef": "string",
    "counterpartyArrangementReference": "string",
    "amount": 42.0,
    "currency": "USD",
    "note": "string",
    "hasEmbedding": true,
    "direction": "sent",
    "leafyPayStatus": "pending",
    "localSyncStatus": "local_pending",
    "createdAt": 1784038802411,
    "settledAt": null,
    "score": 0.397
  }
]
// 400 — missing q: {"error": "Missing required query param: q"}
// 503 — Ollama unreachable: {"error": "Semantic search is temporarily unavailable (Ollama unreachable)"}
// 500 — genuine server-side failure: {"error": "..."}
```

**`POST /local/v1/transactions/send`**: required: `leafyPayTransferReference`,
`ownerPartyRef`, `counterpartyArrangementReference`, `amount`, `currency`, `direction`.
Optional: `note` (embedded via Ollama if present and non-empty).
```json
// Request
{
  "leafyPayTransferReference": "string",
  "ownerPartyRef": "string",
  "counterpartyArrangementReference": "string",
  "amount": 42.0,
  "currency": "USD",
  "direction": "sent",
  "note": "optional string"
}
// 201 — server-assigned: id, leafyPayStatus="pending", localSyncStatus="local_pending",
// createdAt, settledAt=null, hasEmbedding
{
  "id": 1,
  "leafyPayTransferReference": "string",
  "ownerPartyRef": "string",
  "counterpartyArrangementReference": "string",
  "amount": 42.0,
  "currency": "USD",
  "note": "optional string",
  "hasEmbedding": true,
  "direction": "sent",
  "leafyPayStatus": "pending",
  "localSyncStatus": "local_pending",
  "createdAt": 1784038802411,
  "settledAt": null
}
// 400 — invalid JSON or missing required field: {"error": "..."}
// 500 — genuine server-side failure (e.g. store write): {"error": "..."}
```

**`DELETE /local/v1/transactions/{id}`**: `{id}` is the numeric ObjectBox id (not the Mongo
`_id`). Deleting propagates through ObjectBox Sync like any other write, so it also removes
the corresponding document from Atlas once connected.
```json
// 204 — no body
// 404 — {"error": "Transaction not found"}
// 500 — genuine server-side failure: {"error": "..."}
```

**`GET /local/v1/contacts`**: no request body; returns an array of the same object shape as
the `POST` response below (`200`), or `{"error": "..."}` (`500`).

**`POST /local/v1/contacts`**: required: `ownerPartyRef`, `counterpartyArrangementReference`,
`counterpartyLabel`, `counterpartyLookupType`, `counterpartyLookupHint`. No optional fields,
and (like `/transactions/send`) no validation beyond checking required fields are present, so
e.g. `counterpartyLookupType` isn't restricted to `"phone"`/`"email"` here the way the backend's
Pydantic model restricts it.
```json
// Request
{
  "ownerPartyRef": "string",
  "counterpartyArrangementReference": "string",
  "counterpartyLabel": "string",
  "counterpartyLookupType": "phone | email",
  "counterpartyLookupHint": "string"
}
// 201 — server-assigned: id, createdAt, updatedAt (both = now on create)
{
  "id": 1,
  "ownerPartyRef": "string",
  "counterpartyArrangementReference": "string",
  "counterpartyLabel": "string",
  "counterpartyLookupType": "phone | email",
  "counterpartyLookupHint": "string",
  "createdAt": 1784042566445,
  "updatedAt": 1784042566445
}
// 400 — invalid JSON or missing required field: {"error": "..."}
// 500 — genuine server-side failure (e.g. store write): {"error": "..."}
```

**`GET /local/v1/chats`**: no request body; returns an array of the same object shape as the
`POST` response below (`200`), or `{"error": "..."}` (`500`).

**`POST /local/v1/chats`**: optional `title` (defaults to `"New chat"` if omitted).
```json
// Request
{"title": "Splitting dinner with Maria"}
// 201 — server-assigned: id, createdAt, updatedAt (both = now on create), localId (= id)
{
  "id": 1,
  "title": "Splitting dinner with Maria",
  "createdAt": 1784133527692,
  "updatedAt": 1784133527692,
  "localId": 1
}
// 400 — invalid JSON: {"error": "..."}
// 500 — genuine server-side failure: {"error": "..."}
```

**`DELETE /local/v1/chats/{chatId}`**: also removes every message under that chat.
```
// 204 — no body
// 404 — chatId doesn't exist: {"error": "Chat not found"}
```

**`GET /local/v1/chats/{chatId}/messages`**: no request body; returns an array of the same
object shape as the `POST` response below (`200`), 404 if `chatId` doesn't exist, or
`{"error": "..."}` (`500`).

**`POST /local/v1/chats/{chatId}/messages`**: required: `role` (must be `"user"` or
`"assistant"`), `text`. Also bumps the parent chat's `updatedAt`.
```json
// Request
{"role": "user", "text": "Split the dinner bill with Maria"}
// 201 — server-assigned: id, createdAt
{
  "id": 1,
  "chatId": 1,
  "role": "user",
  "text": "Split the dinner bill with Maria",
  "createdAt": 1784133527881
}
// 400 — invalid JSON, missing required field, or role isn't "user"/"assistant": {"error": "..."}
// 404 — chatId doesn't exist: {"error": "Chat not found"}
// 500 — genuine server-side failure: {"error": "..."}
```

**`DELETE /local/v1/chats/{chatId}/messages/{messageId}`**
```
// 204 — no body
// 404 — messageId doesn't exist, or doesn't belong to chatId: {"error": "Chat message not found"}
```

**`DELETE /local/v1/contacts/{id}`**: same semantics as the transaction delete above.
```json
// 204 — no body
// 404 — {"error": "Contact not found"}
// 500 — genuine server-side failure: {"error": "..."}
```

**`GET /local/v1/accounts`**: no request body; returns an array of the same object shape as
the `PUT` response below (`200`), or `{"error": "..."}` (`500`). Never touches Atlas.

**`PUT /local/v1/accounts/{accountReference}`**: **upsert**, unlike every other write endpoint
above — `{accountReference}` is Leafy Pay's own account reference (a string, not our internal
numeric id), and calling this again with the same reference updates the existing row in place
rather than creating a second one. Required: `ownerPartyRef`, `label`, `currency`,
`balanceValue`. Optional: `maskedIban`, `isDefault` (defaults `false`). Every field you send
fully replaces the stored value — this is a real `PUT` (full replacement), not a partial
`PATCH`, so omitting `maskedIban` on a later call clears it back to `null` rather than leaving
the previous value alone.
```json
// Request
{
  "ownerPartyRef": "string",
  "label": "Main account",
  "currency": "EUR",
  "balanceValue": 120.50,
  "maskedIban": "**** 1234",
  "isDefault": true
}
// 201 (first time for this accountReference) or 200 (updated in place) — server-assigned:
// id (stable across updates), lastRefreshedAt (bumped on every call)
{
  "id": 1,
  "ownerPartyRef": "string",
  "accountReference": "string",
  "label": "Main account",
  "currency": "EUR",
  "balanceValue": 120.50,
  "maskedIban": "**** 1234",
  "isDefault": true,
  "lastRefreshedAt": 1784191723874
}
// 400 — invalid JSON or missing required field: {"error": "..."}
// 500 — genuine server-side failure: {"error": "..."}
```

**`DELETE /local/v1/accounts/{accountReference}`**: keyed by the same string reference as
`PUT`, not a numeric id.
```json
// 204 — no body
// 404 — {"error": "Account not found"}
// 500 — genuine server-side failure: {"error": "..."}
```

### Non-obvious things learned building this (empirically, not from docs)

- **The ObjectBox entity's registered name is the target MongoDB collection name. Not the
  C++ struct name**: the string passed to `obx_model_entity(model, "walletTransactions", ...)`
  and the `"name"` field in `objectbox-sync-server/objectbox-model.json` must match each other
  and must equal the desired collection name.
- **That name can't contain hyphens**: ObjectBox entity identifier rules reject them (we hit
  this trying `sync-test`; `syncTest` worked fine).
- **Entity/property UIDs must match exactly** between `objectbox-sync-server/objectbox-model.json`
  and `leafy-local-store/local_store_service.cpp`'s `create_obx_model()`. A mismatch doesn't
  error loudly, writes just silently stay local-only and never reach Atlas.
- **Mongo's `_id` is untouched by ObjectBox's own `int64` id**: the bridge lets MongoDB
  generate a fresh `ObjectId` as usual; there's no collision or id-scheme conflict to worry
  about.
- **A synced entity's own primary-key `id` doesn't carry over as a field — only a regular
  (non-PK) property does.** Only bites you when two synced entities need to reference each
  other, like `chats` → `chatMessages`: `chatMessages.chatId` syncs through fine (it's a
  plain `Long`, not a PK), but `LocalChat.id` (the PK) gets dropped when writing to Mongo, so
  there was nothing left in the synced `chats` document to match it against. Fixed by adding
  `LocalChat.localId`, a second, non-PK field that mirrors `id` right after ObjectBox assigns
  it on creation — see [Sync-related fields](#sync-related-fields).
- **After clearing/recreating the sync server's local state, "Full Import" must be re-run.**
  It's tracked per local state, not per Atlas collection.
- **Use `OBXPropertyType_Date`, not `Long`, for real timestamps.** The bridge maps `Date` to a
  genuine BSON `ISODate`; `Long` maps to a plain `Int64`. We initially used `Long` for
  `createdAt`/`settledAt` and only caught it by inspecting the raw Atlas document — the FastAPI
  backend's Pydantic layer silently "fixed" the display (it coerces large ints into datetimes),
  masking that the actual stored type was wrong. `syncClock` (on the two entities that still
  have it) stays `Long` regardless — it never held a timestamp-shaped value in anything
  observed (see [Sync-related fields](#sync-related-fields)).
- **ObjectBox's vector search `score` is a distance, not a similarity.** `findWithScores()`
  returns lower-is-better, already sorted nearest-first — opposite of Atlas's `$vectorSearch`
  score (higher-is-better). Easy to misread a result set as "backwards" if you forget which
  convention applies to which endpoint.
- **The local ObjectBox data volume doesn't know about your model changes.** ObjectBox refuses
  to open a store whose on-disk model has a *higher* last-entity-id than the model you're
  opening it with (`Can not open store: DB's last entity ID N is higher than M from model`).
  This bites you switching between local branches with different entity counts, since
  `leafy_local_store_data` is a regular Docker volume that persists across `git checkout` —
  it has no idea the code changed. Fix: `docker compose down leafy-local-store && docker
  volume rm leafy-wallet_leafy_local_store_data` for a clean slate (safe — it's disposable
  local dev/demo data, nothing tracked in git or Atlas).
- **Removing an ObjectBox property: leave a gap, don't renumber, don't reuse the uid.** When
  `syncClock` was dropped from `LocalChat`/`LocalChatMessage`, the fix was to delete its
  `obx_model_property(...)` line entirely but *keep* `obx_model_entity_last_property_id(...)`
  pointing at its old id/uid rather than lowering it back down — that call's job is to record
  the highest property id/uid *ever* issued for the entity, not just the ones currently active,
  so a future property never accidentally reuses a retired number. Mirrored the same idea in
  `objectbox-sync-server/objectbox-model.json` by adding the retired uid to
  `retiredPropertyUids` instead of just deleting it silently. Didn't find (or need) an explicit
  C-API "retire this property" call for the local model — deleting the registration line while
  keeping the last-property-id call was sufficient, verified by rebuilding, wiping the local
  volume (same reason as above — the uid's meaning had changed), and re-running
  `test_leafy_local_store_sync.py` end-to-end.
