import { CheckCheck, Database, ShieldCheck } from 'lucide-react'
import { SsoLoginVisual } from '@/components/stage/walkthrough/SsoLoginVisual'
import { DEMO_USERS } from '@/lib/demo-users'
import { BalanceFromDeviceVisual } from '@/components/stage/walkthrough/BalanceFromDeviceVisual'
import { AccountsCarouselVisual } from '@/components/stage/walkthrough/AccountsCarouselVisual'
import { BackgroundSyncVisual } from '@/components/stage/walkthrough/BackgroundSyncVisual'
import { LocalHistoryVisual } from '@/components/stage/walkthrough/LocalHistoryVisual'
import { PaymentStatusVisual } from '@/components/stage/walkthrough/PaymentStatusVisual'
import { ContactLookupVisual } from '@/components/stage/walkthrough/ContactLookupVisual'
import { NameResolutionVisual } from '@/components/stage/walkthrough/NameResolutionVisual'
import { ContactsOfflineVisual } from '@/components/stage/walkthrough/ContactsOfflineVisual'
import { AssistantRoutingVisual } from '@/components/stage/walkthrough/AssistantRoutingVisual'
import { LocalModelVisual } from '@/components/stage/walkthrough/LocalModelVisual'
import { SendSettleVisual } from '@/components/stage/walkthrough/SendSettleVisual'
import { SendQueueVisual } from '@/components/stage/walkthrough/SendQueueVisual'
import { SendSyncVisual } from '@/components/stage/walkthrough/SendSyncVisual'
import { RequestComposeVisual } from '@/components/stage/walkthrough/RequestComposeVisual'
import { RequestDeliverVisual } from '@/components/stage/walkthrough/RequestDeliverVisual'
import { RequestReplicaVisual } from '@/components/stage/walkthrough/RequestReplicaVisual'
import { HybridSearchVisual } from '@/components/stage/walkthrough/HybridSearchVisual'

// Behind-the-scenes walkthrough shown on the stage, keyed to the active wallet screen. Written for a
// non-engineer presenter. Each step carries an icon, or a `visual` filling the illustration tile.
export const WALKTHROUGH = {
  login: {
    label: 'Sign in',
    // One step on purpose: splitting it left the presenter waiting out a slide for the password,
    // which is still shown because Continue with SSO leaves the form empty.
    steps: [
      {
        visual: SsoLoginVisual,
        title: 'Sign in as a demo user',
        body: 'Tap a profile and its email and password arrive already filled in. Continue with SSO starts from an empty form, so type the password every profile shares:',
        copyable: DEMO_USERS[0].password,
      },
    ],
  },
  home: {
    label: 'Home',
    steps: [
      {
        visual: BalanceFromDeviceVisual,
        title: 'Balance from the device',
        body: 'Your balance is saved on the phone, not just fetched from the server. Go offline and it is still right there.',
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
        body: 'Your full history lives on the phone, so it is always there and always fast, online or off.',
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
        body: 'Back online, the payment goes to the payment platform for real, and its answer flips the row from pending to confirmed. Atlas receives the settled copy through Sync.',
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
        body: 'Tap send and it saves to the phone instantly as pending, then flips to completed once it truly settles.',
      },
      {
        visual: SendQueueVisual,
        title: 'Queued while offline',
        body: 'No connection? It waits in a queue on the device and sends itself the moment one returns. Nothing lost.',
      },
      {
        visual: SendSyncVisual,
        title: 'Synced on reconnect',
        body: 'Back online, the payment platform settles it for real, the phone records the answer, and Sync carries it up to MongoDB Atlas. Phone and cloud end up holding the same result.',
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
        visual: RequestReplicaVisual,
        title: 'Kept close by',
        body: 'Every request is written on the phone itself, so the list is already there the next time the signal is not. MongoDB Atlas gets its own copy through Sync.',
      },
    ],
  },
  people: {
    label: 'People',
    steps: [
      {
        visual: ContactLookupVisual,
        title: 'Emails are never stored',
        body: 'You add a contact by email, but the phone never keeps it. Leafy Pay resolves the address and only a masked hint comes back, so the wallet holds no personal data.',
      },
      {
        visual: NameResolutionVisual,
        title: 'Friendly names, resolved',
        body: 'Leafy Pay hides who the other person really is. The contact directory in MongoDB Atlas maps that obscured reference to a name, so you see "Luis", not a raw code.',
      },
      {
        visual: ContactsOfflineVisual,
        title: 'Your people, even offline',
        body: 'The whole contact directory lives on the phone, so names still resolve and you can start a payment with zero signal. Your people are always there.',
      },
    ],
  },
  ai: {
    label: 'Assistant',
    steps: [
      {
        visual: AssistantRoutingVisual,
        title: 'An assistant that checks, never guesses',
        body: 'Ask in plain words and it routes to the right tool, then answers only from your real data, never a guess.',
      },
      {
        visual: HybridSearchVisual,
        title: 'Two ways to find a payment',
        body: 'Offline, the phone finds payments by meaning alone, using its own vector index. Online, MongoDB Atlas runs that same meaning search next to an exact-term search and fuses the two rankings.',
      },
      {
        visual: LocalModelVisual,
        title: 'AI that stays on the machine',
        body: 'The model runs locally, so money questions never leave the demo machine. Online, its tools call the MongoDB MCP server over Atlas; offline they read the phone’s copy.',
      },
    ],
  },
}
