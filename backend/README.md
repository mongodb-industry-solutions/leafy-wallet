# Leafy Wallet Backend

**Leafy Wallet Backend is the enrichment API for our offline-first wallet demo**, showcasing MongoDB features tailored for [Financial Services](https://www.mongodb.com/solutions/industries/financial-services). It is a [FastAPI](https://fastapi.tiangolo.com/) service, managed with [uv](https://docs.astral.sh/uv/), that owns the wallet data living in [MongoDB Atlas](https://www.mongodb.com/atlas): contacts, payment requests, chats, and transaction history with its search indexes. Balances and real transfers live in the Payment Platform (PSP), not here; this service holds no money-moving credentials.

## Components and Features:

1. **Wallet collections API**
   - Read-only routers for contacts, requests, and transactions. Writes reach Atlas through ObjectBox Sync, not through here.

2. **Hybrid search**
   - Transaction notes are embedded with Voyage AI (`voyage-4-nano`) and searched with `$rankFusion`, fusing Atlas Vector Search and Atlas Search.

3. **Spending summaries**
   - Per-contact totals computed by the aggregation framework, so clients (and the AI assistant) never sum rows themselves.

4. **Read-only MCP server**
   - A mounted MCP app exposes the collections as read-only tools. The wallet's own assistant calls it for online reads, and any external MCP client can connect to the same endpoint.

## Where Does MongoDB Shine?

Each router prefix maps to its own Atlas collection: `/api/v1/wallet-contacts`, `/wallet-requests`, and `/wallet-transactions`. All are GET-only. `/wallet-transactions/search` runs hybrid search over `walletTransactionsHistory`, and `/wallet-transactions/summary` runs the spending aggregation.

- **Flexible schema** lets enrichment documents evolve (notes, embeddings, settlement metadata) without migrations.
- **Hybrid search** fuses Atlas Vector Search and Atlas Search over `walletTransactionsHistory`, so meaning, exact terms and typos all resolve. The device has vector search only.
- **Aggregation pipelines** compute spending-by-contact server-side, keeping arithmetic out of the LLM.
- **The document model** mirrors the on-device ObjectBox entities one-to-one, which is what makes the sync story clean.

## Tech Stack

- **Database**:
  - [MongoDB Atlas](https://www.mongodb.com/atlas/database) via [PyMongo](https://pymongo.readthedocs.io/)

- **Web Framework**:
  - [FastAPI](https://fastapi.tiangolo.com/) on [uv](https://docs.astral.sh/uv/)

- **AI**:
  - Embeddings: [voyage-4-nano](https://huggingface.co/voyageai/voyage-4-nano), served by the `leafy-embed` container at 1024 dimensions

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- A MongoDB Atlas cluster (M0 or higher)
- A running `leafy-embed` for embeddings (the repo's Docker Compose handles this)

### Add environment variables

> **_Note:_** Create a `.env` file within the `/backend` directory.

```bash
MONGODB_URI="<your-atlas-connection-string>"
DATABASE_NAME="<your-database-name>"
```

## Running

The whole demo runs with Docker from the repository root. See [Run with Docker](../README.md#run-with-docker) in the main README. Once up, interactive API docs are served at http://localhost:8000/docs.

## Testing

Integration tests run against the real Atlas cluster and skip themselves when it is unreachable:

```bash
cd backend && uv run pytest
```

## Common errors

- Check that you've created a `.env` file with `MONGODB_URI` and `DATABASE_NAME`, and that your IP is on the Atlas network access list.
- Vector search endpoints need the index to exist; run `uv run python scripts/create_vector_index.py` if searches return nothing. It's idempotent, so re-running is safe.
- An empty `walletTransactionsHistory` means the Atlas Database Trigger isn't running. Check its log in the Atlas UI: `cannot access member 'db' of undefined` means the service name in `scripts/atlas_trigger_transaction_history.js` doesn't match your cluster, and invocations that succeed without writing mean Full Document is off. The Trigger only sees changes made after it was created, so existing transactions never appear.

## 📄 License

See [LICENSE](../LICENSE) file for details.
