# Leafy Wallet API

Python backend for Leafy Wallet, built with [FastAPI](https://fastapi.tiangolo.com/) and MongoDB Atlas. It stores a display cache of Leafy Pay beneficiaries (`walletContacts`) and an enrichment layer over Leafy Pay P2P transfers (`walletTransactions`), including semantic-search embeddings generated locally via [Ollama](https://ollama.com/). Dependency management is handled by [uv](https://docs.astral.sh/uv/).

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)

## Features

- RESTful CRUD API for `walletContacts` and `walletTransactions`, powered by FastAPI + Pydantic schemas.
- MongoDB Atlas persistence via `pymongo`, with a shared connection injected through FastAPI dependencies.
- Automatic semantic-search embedding generation for transaction notes via a local Ollama model, without blocking writes if Ollama is unavailable.
- Dependency management with uv ([more info](https://docs.astral.sh/uv/)).

## Prerequisites

Before you begin, ensure you have:

- Python 3.13 (but less than 3.14)
- uv (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))
- A MongoDB Atlas cluster with a database user (Database Access) and your IP allow-listed (Network Access)
- [Ollama](https://ollama.com/) running locally with the `nomic-embed-text` model pulled — optional, only needed for `noteEmbedding` generation on transactions. Two ways to get this:
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

**Note:** open Swagger/ReDoc using `localhost`, not `0.0.0.0` — browsers will reject the "Try it out" requests against `0.0.0.0` even though the page itself loads fine.

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
| `GET` | `/api/v1/wallet-transactions/{id}` | Get a transaction by id |
| `PATCH` | `/api/v1/wallet-transactions/{id}` | Partially update a transaction (status, settlement, embedding) |
| `DELETE` | `/api/v1/wallet-transactions/{id}` | Delete a transaction |

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
│   └── registry.py          # collection name -> canonical schema map
├── services/
│   └── ollama.py             # Embedding client for noteEmbedding
├── routers/
│   ├── wallet_contacts.py    # CRUD endpoints
│   └── wallet_transactions.py
└── tests/                    # pytest integration tests (run against Atlas)
```

## Testing

```bash
cd backend
uv run pytest -v
```

Tests run as integration tests directly against MongoDB Atlas using the credentials in `.env`. If Atlas isn't reachable (e.g. no database user configured yet), the whole suite skips cleanly instead of failing. Each test cleans up the documents it creates.
