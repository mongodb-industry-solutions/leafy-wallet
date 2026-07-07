import {
  ArrowDownLeft,
  CheckCheck,
  Clock,
  CloudUpload,
  Cpu,
  Database,
  ListChecks,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Waypoints,
  Zap,
} from 'lucide-react'

// Behind-the-scenes walkthrough shown on the stage, keyed to the active wallet
// screen. Each flow narrates the MongoDB tech powering that screen; every step
// carries an icon for the illustration area.
export const WALKTHROUGH = {
  home: {
    label: 'Home',
    steps: [
      {
        icon: Database,
        title: 'Balance from the device',
        body: 'Your balance is read directly from the on-device ObjectBox store, so it shows the instant the app opens. There’s no round-trip to a server, and it stays fully readable even with no signal at all.',
      },
      {
        icon: RefreshCw,
        title: 'Quiet background sync',
        body: 'The moment you’re back online, local writes stream up to MongoDB Atlas through the ObjectBox Sync connector. It runs in the background — no spinners, and nothing blocks the interface.',
      },
    ],
  },
  activity: {
    label: 'Activity',
    steps: [
      {
        icon: Database,
        title: 'One local source of truth',
        body: 'The whole history renders straight from ObjectBox, so your activity is always there whether you’re online or completely offline. The list never waits on the network to paint.',
      },
      {
        icon: ListChecks,
        title: 'Per-row sync state',
        body: 'Every row carries its own status — pending, confirmed, or failed — mirrored from Atlas change streams. You always know exactly which payments have made it to the cloud.',
      },
    ],
  },
  transaction: {
    label: 'Transaction',
    offlineMoment: true,
    steps: [
      {
        icon: Database,
        title: 'Written locally first',
        body: 'The transaction commits to ObjectBox immediately as pending_sync, so the money moves the instant you tap. Nothing depends on a live connection to feel done.',
      },
      {
        icon: ShieldCheck,
        title: 'ACID keeps it honest',
        body: 'Multi-document ACID transactions keep balances correct even when several offline writes land at once. No double-spends, no drift — the ledger stays consistent.',
      },
      {
        icon: CheckCheck,
        title: 'Confirmed on reconnect',
        body: 'Back online, the write syncs to Atlas and flips from pending to confirmed via change streams. The status you see is the real server state, reflected back to the device.',
      },
    ],
  },
  send: {
    label: 'Send money',
    offlineMoment: true,
    steps: [
      {
        icon: Zap,
        title: 'Optimistic write',
        body: 'The payment is recorded locally and shown right away, with no waiting on the network. The UI treats it as done the moment it’s durable on the device.',
      },
      {
        icon: Clock,
        title: 'Queued while offline',
        body: 'If you’re offline, it simply waits in the ObjectBox queue. As soon as a connection returns, it sends automatically — the presenter never has to retry by hand.',
      },
      {
        icon: CloudUpload,
        title: 'Synced to Atlas',
        body: 'Once online, the Sync connector pushes the payment up to MongoDB Atlas in the background, where server-side triggers can pick it up for fraud checks and more.',
      },
    ],
  },
  request: {
    label: 'Request money',
    offlineMoment: true,
    steps: [
      {
        icon: ArrowDownLeft,
        title: 'A local intent',
        body: 'The request is stored on the device first, so composing it works with no signal. It behaves exactly like any other locally-first write.',
      },
      {
        icon: Send,
        title: 'Delivered on sync',
        body: 'When both sides are online, Atlas fans the request out to the recipient. The document model makes it easy to attach notes, splits, or context along the way.',
      },
    ],
  },
  people: {
    label: 'People',
    steps: [
      {
        icon: Search,
        title: 'Search that works offline',
        body: 'Contacts and notes are searchable with Atlas Vector Search when online, and with on-device vectors when offline. The same natural query works in either mode.',
      },
    ],
  },
  ai: {
    label: 'Assistant',
    steps: [
      {
        icon: Waypoints,
        title: 'LangGraph routing',
        body: 'Your natural-language request is routed by a LangGraph agent to the right tool for the job — sending, requesting, splitting, or answering a spending question.',
      },
      {
        icon: Cpu,
        title: 'Online vs offline tools',
        body: 'Online, the agent calls MCP tools backed by Atlas. Offline, it falls back to local tools and on-device vectors, so the assistant keeps working with no connection.',
      },
    ],
  },
}
