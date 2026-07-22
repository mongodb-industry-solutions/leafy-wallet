import {
  ArrowDownLeft,
  CheckCheck,
  Clock,
  CloudUpload,
  Cpu,
  Database,
  ListChecks,
  Search,
  Send,
  ShieldCheck,
  Waypoints,
  Zap,
} from 'lucide-react'
import { SsoLoginVisual } from '@/components/stage/Walkthrough/SsoLoginVisual'
import { DemoUsersVisual } from '@/components/stage/Walkthrough/DemoUsersVisual'
import { BalanceFromDeviceVisual } from '@/components/stage/Walkthrough/BalanceFromDeviceVisual'
import { AccountsCarouselVisual } from '@/components/stage/Walkthrough/AccountsCarouselVisual'
import { BackgroundSyncVisual } from '@/components/stage/Walkthrough/BackgroundSyncVisual'

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
        visual: BalanceFromDeviceVisual,
        title: 'Balance from the device',
        body: 'The balance comes from the Leafy Pay service, but it is also saved in the local database on the phone. So if you go offline, the value is still there to see.',
      },
      {
        visual: AccountsCarouselVisual,
        title: 'All your accounts',
        body: 'In Leafy Wallet you can see and use every account you hold on the Leafy Pay service, all from one place.',
      },
      {
        visual: BackgroundSyncVisual,
        title: 'Local and Atlas, always in step',
        body: 'The on-device database and MongoDB Atlas are mirror copies of each other. Every time the connection comes back, the two sync so both hold the same, up-to-date data.',
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
        title: 'Delivered by the bank',
        body: 'Back online, the request goes to Leafy Pay as a real request to pay. It lands in the other person’s wallet and the money only moves once they approve it.',
      },
      {
        icon: Database,
        title: 'Kept close by',
        body: 'A copy of every request rides down through Atlas onto the phone, so the list is still there to read the next time the signal is not.',
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
        body: 'The model runs locally, so money questions never leave the demo machine. Online, its tools call the MongoDB MCP server over Atlas; offline they read the phone’s copy.',
      },
    ],
  },
}
