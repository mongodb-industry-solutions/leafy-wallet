// The self-driving demo script (PLAN.md Phase 2/3). The tour is cursor-driven: every step is an
// action the simulated cursor performs on a real element - it moves there and actually clicks, types,
// or scrolls, so nothing happens by an invisible trigger. The director (useTourDirector) walks these
// and the cursor (TourCursor) executes them against `data-tour-target` anchors in the live UI.
//
// Each action:
//   type: 'click' | 'type' | 'scroll'
//   target: the data-tour-target to act on (a real button, input, tab, the connection toggle, ...)
//   text: for 'type', what to typewrite into the input
//   by: for 'scroll', pixels to scroll the target container
//   walkthroughStep: which "Under the hood" narration step pairs with this action
//   readMs: how long to hold after the action so the narration can be read

const AI_PROMPT = 'How much did I spend this month?'
const NOTE_TEXT = 'Thanks for lunch'

/**
 * @typedef {object} TourAction
 * @property {'click'|'type'|'scroll'} type
 * @property {string} target - data-tour-target to act on.
 * @property {string} [text] - Text to type (type actions).
 * @property {number} [by] - Pixels to scroll (scroll actions).
 * @property {string} [say] - First-person line for the cursor's speech bubble; when omitted the
 *   previous bubble stays up (so a run of digit taps does not flicker).
 * @property {string} [sayDone] - Bubble shown after `waitFor` resolves (e.g. "it settled").
 * @property {string} [waitFor] - data-tour-signal to poll for before finishing (e.g. settlement).
 * @property {number} walkthroughStep - Narration step for the current screen.
 * @property {number} readMs - Hold after the action so the narration can be read.
 */

/** @type {TourAction[]} */
export const TOUR = [
  // Home: balance from the device, then scroll through accounts and history.
  { type: 'click', target: 'tab-home', say: 'Let me show you around. This is home.', walkthroughStep: 0, readMs: 1800 },
  { type: 'scroll', target: 'wallet-scroll', by: 300, say: 'Your balance and accounts, all on the device.', walkthroughStep: 1, readMs: 2600 },
  { type: 'scroll', target: 'wallet-scroll', by: 320, say: 'And your full history, right here.', walkthroughStep: 2, readMs: 2600 },
  { type: 'scroll', target: 'wallet-scroll', by: -640, say: "Now let's send some money.", walkthroughStep: 0, readMs: 700 },

  // People: open the first contact into a send.
  { type: 'click', target: 'tab-people', say: "First, I'll pick someone to pay.", walkthroughStep: 0, readMs: 1400 },
  { type: 'click', target: 'contact-0', say: "Let's pay this contact.", walkthroughStep: 0, readMs: 700 },

  // Compose: tap €10.00 (cents), pick Pay, type a note.
  { type: 'click', target: 'key-1', say: 'Entering €10.00 on the keypad.', walkthroughStep: 0, readMs: 150 },
  { type: 'click', target: 'key-0', walkthroughStep: 0, readMs: 150 },
  { type: 'click', target: 'key-0', walkthroughStep: 0, readMs: 150 },
  { type: 'click', target: 'key-0', walkthroughStep: 0, readMs: 350 },
  { type: 'click', target: 'send-pay', say: 'Then hit Pay.', walkthroughStep: 0, readMs: 900 },
  { type: 'type', target: 'send-note', text: NOTE_TEXT, say: "I'll add a quick note.", walkthroughStep: 0, readMs: 1000 },

  // The offline moment: the cursor leaves the phone to flip the connection off, then sends (it queues).
  { type: 'click', target: 'connection-toggle', say: "Now watch, I'll go offline.", walkthroughStep: 1, readMs: 1500 },
  { type: 'click', target: 'send-submit', say: 'Sending it, even with no connection.', walkthroughStep: 1, readMs: 1800 },
  { type: 'click', target: 'send-done', say: 'Saved on the device, queued to sync.', walkthroughStep: 1, readMs: 900 },

  // Activity: the payment shows pending; then the cursor reconnects and waits for it to actually settle.
  { type: 'click', target: 'tab-activity', say: "Here it is in Activity, still pending.", walkthroughStep: 0, readMs: 2200 },
  {
    type: 'click',
    target: 'connection-toggle',
    say: 'Back online, syncing it to Atlas…',
    sayDone: 'There it is, completed and settled.',
    waitFor: 'settled',
    walkthroughStep: 1,
    readMs: 600,
  },

  // Assistant: new chat, then typewrite the question and send it.
  { type: 'click', target: 'tab-ai', say: "Last, let's ask the assistant.", walkthroughStep: 0, readMs: 1200 },
  { type: 'click', target: 'ai-new-chat', say: 'Start a fresh chat.', walkthroughStep: 0, readMs: 900 },
  { type: 'type', target: 'ai-input', text: AI_PROMPT, say: "I'll ask about my spending.", walkthroughStep: 0, readMs: 600 },
  { type: 'click', target: 'ai-send', say: 'And send. It answers from real data.', walkthroughStep: 0, readMs: 5000 },
]

export const TOUR_LENGTH = TOUR.length
