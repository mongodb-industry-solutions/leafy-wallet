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
import { SsoLoginVisual } from '@/components/stage/Walkthrough/SsoLoginVisual'
import { DemoUsersVisual } from '@/components/stage/Walkthrough/DemoUsersVisual'

// Behind-the-scenes walkthrough shown on the stage, keyed to the active wallet
// screen. Written for a non-engineer presenter: plain language, with a tech term
// only where it is the point of the step. Each step carries an icon; a step may
// instead carry a `visual` component that fills the illustration tile.
export const WALKTHROUGH = {
  login: {
    label: 'Sign in',
    steps: [
      {
        visual: SsoLoginVisual,
        title: 'Start with SSO',
        body: 'Click Continue with SSO. It opens Leafy Pay’s real login page; your password never touches the wallet app.',
      },
      {
        visual: DemoUsersVisual,
        title: 'Sign in as a demo user',
        body: 'Pick any of the three and type the email and password exactly as shown.',
      },
    ],
  },
  home: {
    label: 'Home',
    steps: [
      {
        icon: Database,
        title: 'Balance from the device',
        body: 'The balance is read from a small database inside the phone, not from a server. That is why it shows instantly and still works with zero signal.',
      },
      {
        icon: RefreshCw,
        title: 'Quiet background sync',
        body: 'Back online, everything written on the device copies up to MongoDB Atlas, the cloud database, in the background. No spinners, nothing to retry by hand.',
      },
    ],
  },
  activity: {
    label: 'Activity',
    steps: [
      {
        icon: Database,
        title: 'One local source of truth',
        body: 'The full payment history lives on the phone, so scrolling never waits on the network. Online or offline, the list is always there and always fast.',
      },
      {
        icon: ListChecks,
        title: 'Every payment knows its status',
        body: 'Each row shows pending, confirmed, or failed, straight from the cloud as things settle. You see what really happened, not what the phone hopes.',
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
        body: 'Tap send and the payment saves to the phone first, marked as waiting to sync. It feels instant because nothing waits for a server to answer.',
      },
      {
        icon: ShieldCheck,
        title: 'ACID keeps the math honest',
        body: 'ACID transactions are the bank-grade guarantee: related changes all happen together or none do. Balances never drift, money is never counted twice.',
      },
      {
        icon: CheckCheck,
        title: 'Confirmed on reconnect',
        body: 'Back online, the payment uploads to Atlas and flips from pending to confirmed. The checkmark is the cloud’s real answer, reflected back to the phone.',
      },
    ],
  },
  send: {
    label: 'Send money',
    offlineMoment: true,
    steps: [
      {
        icon: Zap,
        title: 'Instant by design',
        body: 'The payment shows as done the moment you tap, no network involved. The phone trusts its own copy first and settles up with the cloud afterwards.',
      },
      {
        icon: Clock,
        title: 'Queued while offline',
        body: 'No connection? The payment waits in a queue on the device and sends itself the moment one returns. Nothing to retry, nothing lost.',
      },
      {
        icon: CloudUpload,
        title: 'Synced to Atlas',
        body: 'Once online, the queued payment pushes up to MongoDB Atlas in the background, where the bank side picks it up for fraud checks and reporting.',
      },
    ],
  },
  request: {
    label: 'Request money',
    offlineMoment: true,
    steps: [
      {
        icon: ArrowDownLeft,
        title: 'Composed anywhere',
        body: 'The request saves to the phone first, so you can write it with no signal at all. Safe locally, delivered later.',
      },
      {
        icon: Send,
        title: 'Delivered through the cloud',
        body: 'When both people are online, the request travels through Atlas to the other wallet, carrying its note and context along as one flexible document.',
      },
    ],
  },
  people: {
    label: 'People',
    steps: [
      {
        icon: Search,
        title: 'Search by meaning, even offline',
        body: 'Search payments by what they were about, like "coffee", even when the words are not exact. Atlas Vector Search matches online; the phone matches offline.',
      },
    ],
  },
  ai: {
    label: 'Assistant',
    steps: [
      {
        icon: Waypoints,
        title: 'An assistant that checks, never guesses',
        body: 'Ask in plain words and LangGraph routes it to the right tool: balance, spending, or a payment draft. It only answers from real data, never a guess.',
      },
      {
        icon: Cpu,
        title: 'AI that stays on the machine',
        body: 'The model runs locally, so money questions never leave the demo machine. Its tools read Atlas online and the phone’s copy offline. It works either way.',
      },
    ],
  },
}
