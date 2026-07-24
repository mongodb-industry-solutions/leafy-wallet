# Local Deployment — Leafy Wallet with a Local Leafy Pay PSP

This guide describes how to run **Leafy Wallet** locally against a local instance of the **Leafy Pay
PSP** (`sec-fsi-pci-dss`), with SSO login and payments functioning end to end.

The recommended configuration runs the **PSP in development (native) mode** and **Leafy Wallet in
Docker**. In development mode the PSP services listen on host ports that match the application defaults,
which removes the need for container-to-container networking configuration:

| Service | URL |
|---------|-----|
| PSP backend | `http://localhost:8081` |
| PSP frontend (login / consent) | `http://localhost:8083` |
| PSP merchant demo | `http://localhost:8082` |

Leafy Wallet remains in Docker (ObjectBox, Ollama, and the sync server stay containerized) and reaches
the native PSP through the Docker host gateway.

---

## 1. Repositories

Clone both repositories side by side:

- [Leafy Wallet](https://github.com/mongodb-industry-solutions/leafy-wallet)
- [Leafy Pay (`sec-fsi-pci-dss`)](https://github.com/mongodb-industry-solutions/sec-fsi-pci-dss)

---

## 2. Topology and ports

| Stack | Service | URL | Runtime |
|-------|---------|-----|---------|
| Leafy Pay | backend | `http://localhost:8081` | native (`npm run dev`) |
| Leafy Pay | frontend (login + OAuth consent) | `http://localhost:8083` | native |
| Leafy Pay | merchant demo (Espresso) | `http://localhost:8082` | native |
| Leafy Wallet | frontend (UI + BFF/OAuth client) | `http://localhost:8080` | Docker |
| Leafy Wallet | backend (Atlas enrichment / chat / MCP) | `http://localhost:8000` | Docker |
| Leafy Wallet | local store (ObjectBox) | `http://localhost:8090` | Docker |
| Leafy Wallet | Ollama | `http://localhost:11434` | Docker |
| Leafy Wallet | ObjectBox sync | `9980` / `9999` | Docker |

The PSP seeds two OAuth clients in `backend/data/merchants.json`:

- **Leafy Wallet client.** Use this client. Its `client_id` and `client_secret` are provided in
  `leafy-wallet/frontend/.env.local.example`. Registered redirect URI:
  `http://localhost:8080/api/auth/callback`.
- **Espresso merchant client.** For the merchant demo only. Using it with Leafy Wallet results in a
  `redirect_uri not registered` error.

---

## 3. Prerequisites

- **Docker Desktop**, which provides the `host.docker.internal` gateway used by the wallet container.
- **Node.js**, to run the native PSP.
- **`uv`**, to run the Leafy Wallet backend tooling (for example, the vector search index script).
- A **MongoDB Atlas cluster** with **two separate databases** — one per project:
  - A **Leafy Pay** database, used by the PSP (including Queryable Encryption).
  - A **Leafy Wallet** database, used by the Leafy Wallet backend for data enrichment and vector search.

  Each project references its own database through its own environment file; the connection strings are
  not shared between projects. A single Atlas cluster may host both databases.
- The **MongoDB Queryable Encryption crypt library** installed on the host (see Section 4).

---

## 4. Install the MongoDB crypt library

The PSP uses MongoDB Queryable Encryption, which requires the `crypt_shared` library on the host. The
library is available as a direct download; no account or form is required.

For macOS on Apple Silicon (arm64):

```bash
mkdir -p ~/mongodb-crypt && cd ~/mongodb-crypt
curl -sSL -o crypt.tgz \
  "https://downloads.mongodb.com/osx/mongo_crypt_shared_v1-macos-arm64-enterprise-8.0.5.tgz"
tar xzf crypt.tgz
find "$PWD" -name 'mongo_crypt_v1.dylib'
```

For macOS on Intel, use the `macos-x86_64` build; for Linux, use the corresponding `linux` download
directory.

Set the resulting path in the PSP `.env` file:

```dotenv
MONGODB_CRYPT_SHARED_LIB_PATH=/absolute/path/to/mongo_crypt_v1.dylib
```

On startup, the backend logs `[crypt] Using library from MONGODB_CRYPT_SHARED_LIB_PATH: …`, confirming
the path is in use.

---

## 5. Configure the environment files

Each project is configured through its own (gitignored) environment files. Complete all four files below
before launching. Copy from the corresponding `.example` file where one is provided, then set the values
described here.

### 5.1 Leafy Pay — `sec-fsi-pci-dss/.env`

Copy `.env.example` to `.env` and set at least the following. Refer to the Leafy Pay repository for the
complete list.

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Connection string for the **Leafy Pay** database |
| `JWT_SECRET` | Secret used to sign PSP tokens |
| `KMS_PROVIDER` | Key management provider for Queryable Encryption (for example, `local`) |
| `MONGODB_CRYPT_SHARED_LIB_PATH` | Absolute path to `mongo_crypt_v1.dylib` (see Section 4) |

Generate the OAuth signing keys once:

```bash
cd sec-fsi-pci-dss
npm run setup       # install dependencies (first run only)
npm run setup:key:rsa   # writes backend/keys/private.pem
```

### 5.2 Leafy Wallet backend — `leafy-wallet/backend/.env`

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Connection string for the **Leafy Wallet** database (distinct from Leafy Pay) |
| `DATABASE_NAME` | Leafy Wallet database name |

### 5.3 Leafy Wallet frontend — `leafy-wallet/frontend/.env.local`

```dotenv
CLIENT_ID=<from frontend/.env.local.example>
CLIENT_SECRET=<from frontend/.env.local.example>
PSP_BASE_URL=http://host.docker.internal:8081
PSP_FRONTEND_URL=http://localhost:8083
```

The redirect URI is derived as `<APP_BASE_URL>/api/auth/callback`, and `APP_BASE_URL` itself
defaults to `http://localhost:8080` - set neither unless the app is served from another origin.

Notes:

- `PSP_BASE_URL` must use `host.docker.internal`, not `localhost`. Server-side calls run inside the
  wallet container, where `localhost` refers to the container itself.
- The OAuth client registered in Leafy Pay must allow the scopes the wallet asks for at login
  (`frontend/src/lib/auth/env.js`), including `read:rtp` and `write:rtp` for payment requests.
  Leafy Pay rejects the whole login with `invalid_scope` if any requested scope is not registered.
- The two `MONGODB_URI` values point to different databases and are configured independently.

---

## 6. Launch

Start the PSP (native):

```bash
cd sec-fsi-pci-dss
npm run setup:db    # provision Queryable Encryption collections
npm run setup:seed  # seed demo data (users, OAuth clients, providers)
npm run dev         # backend:8081, frontend:8083, merchant:8082
```

Create the Leafy Wallet vector search index (first run only):

```bash
cd leafy-wallet/backend
uv run python scripts/create_vector_index.py
```

Start Leafy Wallet (Docker):

```bash
cd leafy-wallet
docker compose up -d --build
```

Open `http://localhost:8080` and select **Continue with SSO**.

### Demo credentials

- Email: `amara.okafor@back.es` (Local / Demo Users domain).
- Password: available in the PSP dataset —
  <https://github.com/mongodb-industry-solutions/sec-fsi-pci-dss/wiki/Dataset>.

After granting consent, the browser returns to the Leafy Wallet home page in an authenticated session,
and payments can be sent.

---

## 7. Verification

```bash
# PSP responds on all three ports
curl -s -o /dev/null -w "8081 %{http_code}\n" http://localhost:8081/health   # expect 200
curl -s -o /dev/null -w "8080 %{http_code}\n" http://localhost:8080/         # expect 200
curl -s -o /dev/null -w "8082 %{http_code}\n" http://localhost:8082/         # expect 200

# Leafy Wallet emits the correct client_id and redirect_uri
curl -s -D - -o /dev/null http://localhost:8080/api/auth/login \
  | grep -i '^location' | grep -oE 'client_id=[^&]+|redirect_uri=[^&]+'

# The wallet container can reach the native PSP
docker exec leafy-wallet-frontend sh -c \
  'wget -qO- -T5 http://host.docker.internal:8081/api/v1/auth/jwks >/dev/null && echo OK'
```

