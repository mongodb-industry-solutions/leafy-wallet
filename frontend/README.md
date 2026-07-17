# Leafy Wallet UI

**Leafy Wallet UI is the graphical user interface for our offline-first wallet demo**, showcasing MongoDB features tailored for [Financial Services](https://www.mongodb.com/solutions/industries/financial-services). It renders a mobile-style wallet inside a presenter "stage" that narrates the technology behind each screen, and it keeps working with no connection by reading the on-device store instead of the network.

Beyond the UI, this half of the demo owns the SSO flow, the Server Actions that pick an online or offline data source per read, and the AI chat route that streams the Leafy assistant's replies from a local model.

## Components and Features:

1. **Sign in with SSO**
   - Real authorization-code + PKCE handoff to Leafy Pay's hosted login.
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

Every read in `src/lib/wallet/actions.js` takes the connection state and picks its source: Leafy Pay and Atlas when online, the on-device ObjectBox store when offline. The UI never branches; the Server Action does.

> **[Diagram placeholder: data-source-selection]**
> _Intended diagram: a Server Action box in the middle, with the isOnline flag routing reads either to the backend/Atlas path or to the leafy-local-store path, and the same UI component consuming both._

The AI chat is a single streaming route:

> **[Diagram placeholder: ai-chat-stream]**
> _Intended diagram: browser to POST /api/chat to LangGraph graph to Ollama, with the NDJSON events (token, draft, chart, error) flowing back to the browser as they are produced._

- `POST /api/chat` streams NDJSON events: `token` (reply text), `draft` (a payment card to confirm), `chart` (a spending breakdown), and `error`.
- The LangGraph graph and its wallet tools live in `src/lib/ai/`; tools answer from the same Server Actions the UI uses.

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

Key conventions (see [CLAUDE.md](../CLAUDE.md) for the full guide):

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

## Run it Locally

1. Navigate to the `/frontend` folder.
2. Install dependencies by running:
```bash
npm install
```
3. Start the frontend development server with:
```bash
npm run dev
```
4. The frontend will now be accessible at http://localhost:3000 by default.

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

## Common errors

- Check that you've created an `.env.local` file that contains the required environment variables.
- If the assistant answers "fetch failed", the app can't reach Ollama; when running in Docker the compose file injects the in-network URL automatically.

## 📄 License

See [LICENSE](../LICENSE) file for details.
