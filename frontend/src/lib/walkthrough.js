import { CheckCheck, Database, ShieldCheck } from 'lucide-react'
import { SsoLoginVisual } from '@/components/stage/Walkthrough/SsoLoginVisual'
import { DemoUsersVisual } from '@/components/stage/Walkthrough/DemoUsersVisual'
import { BalanceFromDeviceVisual } from '@/components/stage/Walkthrough/BalanceFromDeviceVisual'
import { AccountsCarouselVisual } from '@/components/stage/Walkthrough/AccountsCarouselVisual'
import { BackgroundSyncVisual } from '@/components/stage/Walkthrough/BackgroundSyncVisual'
import { LocalHistoryVisual } from '@/components/stage/Walkthrough/LocalHistoryVisual'
import { PaymentStatusVisual } from '@/components/stage/Walkthrough/PaymentStatusVisual'
import { BlindIndexVisual } from '@/components/stage/Walkthrough/BlindIndexVisual'
import { NameResolutionVisual } from '@/components/stage/Walkthrough/NameResolutionVisual'
import { ContactsOfflineVisual } from '@/components/stage/Walkthrough/ContactsOfflineVisual'
import { AssistantRoutingVisual } from '@/components/stage/Walkthrough/AssistantRoutingVisual'
import { LocalModelVisual } from '@/components/stage/Walkthrough/LocalModelVisual'
import { SendSettleVisual } from '@/components/stage/Walkthrough/SendSettleVisual'
import { SendQueueVisual } from '@/components/stage/Walkthrough/SendQueueVisual'
import { SendSyncVisual } from '@/components/stage/Walkthrough/SendSyncVisual'
import { RequestComposeVisual } from '@/components/stage/Walkthrough/RequestComposeVisual'
import { RequestDeliverVisual } from '@/components/stage/Walkthrough/RequestDeliverVisual'
import { RequestDownstreamVisual } from '@/components/stage/Walkthrough/RequestDownstreamVisual'

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
        body: 'In Leafy Wallet you can see and use every account you hold on the Payment Platform (PSP) service, all from one place.',
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
        visual: LocalHistoryVisual,
        title: 'One local source of truth',
        body: 'The full payment history lives on the phone, so scrolling never waits on the network. Online or offline, the list is always there and always fast.',
      },
      {
        visual: PaymentStatusVisual,
        title: 'Every payment knows its status',
        body: 'Each row shows pending or completed, straight from the cloud as things settle. You see what really happened, not what the phone hopes.',
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
        visual: SendSettleVisual,
        title: 'Written locally, settles for real',
        body: 'Tap send and the payment saves to the phone right away and shows as pending. It flips to completed once it actually settles, so the status is always the truth.',
      },
      {
        visual: SendQueueVisual,
        title: 'Queued while offline',
        body: 'No connection? The payment waits in a queue on the device and sends itself the moment one returns. Nothing to retry, nothing lost.',
      },
      {
        visual: SendSyncVisual,
        title: 'Synced on reconnect',
        body: 'Once back online, the payment pushes up to MongoDB Atlas and is recorded there the moment it succeeds. The cloud and the phone end up holding the same result.',
      },
    ],
  },
  request: {
    label: 'Request money',
    offlineMoment: true,
    steps: [
      {
        visual: RequestComposeVisual,
        title: 'Composed anywhere',
        body: 'The request saves to the phone first, so you can write it with no signal at all. Safe locally, delivered later.',
      },
      {
        visual: RequestDeliverVisual,
        title: 'Delivered by the PSP',
        body: 'Back online, the request goes through the payment platform (PSP) as a real request to pay. It lands in the other person’s wallet and the money only moves once they approve it.',
      },
      {
        visual: RequestDownstreamVisual,
        title: 'Kept close by',
        body: 'A copy of every request rides down through Atlas onto the phone, so the list is still there to read the next time the signal is not.',
      },
    ],
  },
  people: {
    label: 'People',
    steps: [
      {
        visual: BlindIndexVisual,
        title: 'Emails are never stored',
        body: 'You add a contact by email, but the raw email is never saved. It is turned into a keyed digest, so the wallet can still find people without holding their personal data.',
      },
      {
        visual: NameResolutionVisual,
        title: 'Friendly names, resolved',
        body: 'Leafy Pay hides who the other person really is. The contact directory in MongoDB Atlas maps that obscured reference to a name, so you see "Luis", not a raw code.',
      },
      {
        visual: ContactsOfflineVisual,
        title: 'Your people, even offline',
        body: 'The contact directory syncs onto the phone, so names still resolve and you can start a payment with zero signal. Your people are always there.',
      },
    ],
  },
  ai: {
    label: 'Assistant',
    steps: [
      {
        visual: AssistantRoutingVisual,
        title: 'An assistant that checks, never guesses',
        body: 'Ask in plain words and LangGraph routes it to the right tool: balance, spending, or a payment draft. It only answers from real data, never a guess.',
      },
      {
        visual: LocalModelVisual,
        title: 'AI that stays on the machine',
        body: 'The model runs locally, so money questions never leave the demo machine. Online, its tools call the MongoDB MCP server over Atlas; offline they read the phone’s copy.',
      },
    ],
  },
}
