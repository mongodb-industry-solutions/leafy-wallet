# Leafy Wallet UI

**Leafy Wallet UI is the graphical user interface for our offline-first wallet demo**, showcasing MongoDB features tailored for [Financial Services](https://www.mongodb.com/solutions/industries/financial-services). It renders a mobile-style wallet inside a presenter "stage" that narrates the technology behind each screen, and it keeps working with no connection by reading the on-device store instead of the network.

Beyond the UI, this half of the demo owns the SSO flow, the Server Actions that pick an online or offline data source per read, and the AI chat route that streams the Leafy assistant's replies from a local model.

## Components and Features:

1. **Sign in with SSO**
   - Real authorization-code + PKCE handoff to the Payment Platform (PSP)'s hosted login.
   - A passwordless (FaceID-style) re-entry path for returning users.

2. **Home, Activity, and People tabs**
   - Balances, transaction history with per-row settlement status, and a searchable contact list.

3. **Send and request flows**
   - Numpad, recipient picker, full review step, and a live settlement status on success.

4. **Notifications**
   - Money received and incoming requests; swipe-to-clear, clear all, and pay through the standard review screen.

5. **The Leafy assistant**
   - Streaming chat with a typewriter effect, inline spending charts, and payment draft cards.
   - Chat history persisted per user, in Atlas online and on the device offline.

6. **The presenter stage**
   - Phone frame, connection toggle, and the "Under the hood" walkthrough panel with per-screen steps.

## Where Does MongoDB Shine?

Every read in `src/lib/wallet/actions.js` takes the connection state and picks its source: the PSP and Atlas when online, the on-device ObjectBox store when offline. The UI never branches; the Server Action does.

The AI chat is a single streaming route, and it can draft a real payment along the way:

![Sequence diagram of a payment drafted through chat: the LangGraph agent resolves the contact through the MCP server (online) or ObjectBox (offline), drafts the payment, and on confirmation either queues it locally or submits it to the Payment Platform (PSP) and writes the enrichment record to MongoDB Atlas](../docs/payment-via-chatbot.svg)

- `POST /api/chat` streams NDJSON events: `token` (reply text), `draft` (a payment card to confirm), `chart` (a spending breakdown), and `error`.
- The LangGraph graph and its wallet tools live in `src/lib/ai/`. Online, the read tools call the backend's MCP server (`/mcp`); offline they read the on-device store; balance and drafting stay native.

## Tech Stack

- **Web Framework**:
  - [Next.js](https://nextjs.org/) App Router, JavaScript (not TypeScript)

- **Styling**:
  - [Tailwind CSS](https://tailwindcss.com/) v4
  - shadcn-style primitives in `src/components/ui/`
  - [LeafyGreen UI](https://github.com/mongodb/leafygreen-ui) for icons and the MongoDB mark

- **AI**:
  - [LangGraph](https://www.langchain.com/langgraph) with [@langchain/ollama](https://www.npmjs.com/package/@langchain/ollama)

## Project Structure

```
src/
├── app/                         # Routes: the stage page, auth routes, /api/chat
├── components/
│   ├── stage/                   # Phone frame, login screen, walkthrough panel
│   ├── ui/                      # Flat, reusable primitives (Button, BottomSheet, SwipeableRow, ...)
│   └── wallet/                  # App features: home, activity, send, people, assistant, shell
└── lib/
    ├── ai/                      # LangGraph graph + wallet tools
    ├── auth/                    # OAuth PKCE, session, env access
    ├── backend/enrichment.js    # Calls the FastAPI backend (Atlas enrichment data + search)
    ├── local/LocalStoreClient.js# Calls leafy-local-store (on-device ObjectBox copy)
    ├── wallet/actions.js        # Server Actions that pick online vs. offline sources
    └── walkthrough.js           # Behind-the-scenes narration per screen
```

Key conventions:

- App components each get their own folder with colocated hooks; `ui/` is flat.
- Server Actions over API Routes for internal data operations. API Routes exist only where a real HTTP endpoint is required (OAuth callbacks, the streaming chat route).
- Components stay UI-only; non-trivial state and effects move into a colocated hook.

## Prerequisites

> **_Note:_** Create a `.env.local` file within the `/frontend` directory. Ask the demo owner for the values; names are listed in the [root README](../README.md).

The UI depends on the backend services, which must be running to enable full functionality:

- Backend enrichment API (Port **8000**)
- leafy-local-store (Port **8090**)
- Ollama (Port **11434**)
  - *Needed for the Leafy assistant and semantic search embeddings.*

## Running

The whole demo runs with Docker from the repository root. See [Run with Docker](../README.md#run-with-docker) in the main README.

## Common errors

- Check that you've created an `.env.local` file that contains the required environment variables.
- If the assistant answers "fetch failed", the app can't reach Ollama; when running in Docker the compose file injects the in-network URL automatically.

## 📄 License

See [LICENSE](../LICENSE) file for details.
