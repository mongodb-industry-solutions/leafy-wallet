# Leafy Wallet Backend

**Leafy Wallet Backend is the enrichment API for our offline-first wallet demo**, showcasing MongoDB features tailored for [Financial Services](https://www.mongodb.com/solutions/industries/financial-services). It is a [FastAPI](https://fastapi.tiangolo.com/) service, managed with [uv](https://docs.astral.sh/uv/), that owns the wallet data living in [MongoDB Atlas](https://www.mongodb.com/atlas): contacts, payment requests, chats, and the metadata plus semantic-search index for transactions. Balances and real transfers live in Leafy Pay (the PSP), not here; this service holds no money-moving credentials.

## Components and Features:

1. **Wallet collections API**
   - CRUD routers for contacts, requests, transactions enrichment, chats, and chat messages.

2. **Semantic search**
   - Transaction notes are embedded through a local [Ollama](https://ollama.com/) model and searched with Atlas `$vectorSearch`.

3. **Spending summaries**
   - Per-contact totals computed by the aggregation framework, so clients (and the AI assistant) never sum rows themselves.

4. **Read-only MCP server**
   - A mounted MCP app exposes the collections to AI agents as read-only tools.

## Where Does MongoDB Shine?

> **[Diagram placeholder: request-collection-map]**
> _Intended diagram: each router prefix (/api/v1/wallet-contacts, /wallet-requests, /wallet-transactions, /chats, /chat-messages) mapped to its Atlas collection, with the /search endpoint pointing at the vector index and /summary at the aggregation pipeline._

- **Flexible schema** lets enrichment documents evolve (notes, embeddings, settlement metadata) without migrations.
- **Atlas Vector Search** powers meaning-based transaction search from a single index definition.
- **Aggregation pipelines** compute spending-by-contact server-side, keeping arithmetic out of the LLM.
- **The document model** mirrors the on-device ObjectBox entities one-to-one, which is what makes the sync story clean.

## Tech Stack

- **Database**:
  - [MongoDB Atlas](https://www.mongodb.com/atlas/database) via [PyMongo](https://pymongo.readthedocs.io/)

- **Web Framework**:
  - [FastAPI](https://fastapi.tiangolo.com/) on [uv](https://docs.astral.sh/uv/)

- **AI**:
  - [Ollama](https://ollama.com/) embeddings (nomic-embed-text)

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- A MongoDB Atlas cluster (M0 or higher)
- A running Ollama with the embedding model pulled (the repo's Docker Compose handles this)

### Add environment variables

> **_Note:_** Create a `.env` file within the `/backend` directory.

```bash
MONGODB_URI="<your-atlas-connection-string>"
DATABASE_NAME="<your-database-name>"
OLLAMA_BASE_URL="http://localhost:11434"
```

## Run it Locally

1. From the repository root, install uv and sync dependencies:
```bash
make uv_init
make uv_sync
```
2. Start the API:
```bash
cd backend && uv run uvicorn main:app --reload --port 8000
```
3. Interactive API docs are served at http://localhost:8000/docs.

## Run with Docker

Make sure to run this on the root directory.

1. To run with Docker use the following command:
```
make build
```
2. To delete the containers and images run:
```
make clean
```

## Testing

Integration tests run against the real Atlas cluster and skip themselves when it is unreachable:

```bash
cd backend && uv run pytest
```

## Common errors

- Check that you've created a `.env` file with `MONGODB_URI` and `DATABASE_NAME`, and that your IP is on the Atlas network access list.
- Vector search endpoints need the index to exist; run the provisioning script in `scripts/` if searches return nothing.

## 📄 License

See [LICENSE](../LICENSE) file for details.
