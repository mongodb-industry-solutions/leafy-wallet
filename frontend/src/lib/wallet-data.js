// ─── Seed data ────────────────────────────────────────────────────────────────
export const APP_USERS = [
  { id: 'u1', name: 'Alex Chen', handle: '$alexchen', seed: 'alex-lp', bg: '60a5fa' },
  { id: 'u2', name: 'Maria Garcia', handle: '$mariagarcia', seed: 'maria-lp', bg: 'a78bfa' },
  { id: 'u3', name: 'Jordan Lee', handle: '$jordanlee', seed: 'jordan-lp', bg: 'fb7185' },
  { id: 'u4', name: 'Sam Rivera', handle: '$samrivera', seed: 'sam-lp', bg: '34d399' },
]

// Primary account balance (EUR), numeric — the source for "remaining" math.
export const BALANCE = 12458.32

export const CURRENCIES = [
  { code: 'EUR', symbol: '€', balance: '12,458.32' },
  { code: 'USD', symbol: '$', balance: '2,144.89' },
  { code: 'GBP', symbol: '£', balance: '860.10' },
]

export const CONTACTS = [
  { id: 'c1', name: 'Maria Garcia', handle: '$mariagarcia', seed: 'maria-lp', bg: 'ede9fe' },
  { id: 'c2', name: 'Jordan Lee', handle: '$jordanlee', seed: 'jordan-lp', bg: 'fce7f3' },
  { id: 'c3', name: 'Sam Rivera', handle: '$samrivera', seed: 'sam-lp', bg: 'dcfce7' },
  { id: 'c4', name: 'Taylor Kim', handle: '$taylorkim', seed: 'taylor-lp', bg: 'ffedd5' },
  { id: 'c5', name: 'Casey Brooks', handle: '$caseybrooks', seed: 'casey-lp', bg: 'cffafe' },
]

export const TRANSACTIONS = [
  { id: 't1', name: 'Maria Garcia', handle: '$mariagarcia', amount: 50, note: 'Dinner split', date: 'Today', isPending: false, seed: 'maria-lp', bg: 'ede9fe' },
  { id: 't2', name: 'Jordan Lee', handle: '$jordanlee', amount: -20, note: 'Coffee', date: 'Today', isPending: false, seed: 'jordan-lp', bg: 'fce7f3' },
  { id: 't3', name: 'Sam Rivera', handle: '$samrivera', amount: 120, note: 'Concert tickets', date: 'Yesterday', isPending: false, seed: 'sam-lp', bg: 'dcfce7' },
  { id: 't4', name: 'Casey Brooks', handle: '$caseybrooks', amount: -15, note: 'Parking', date: 'Jun 20', isPending: true, seed: 'casey-lp', bg: 'cffafe' },
  { id: 't5', name: 'Taylor Kim', handle: '$taylorkim', amount: -82.15, note: 'Groceries', date: 'Jun 19', isPending: true, seed: 'taylor-lp', bg: 'ffedd5' },
  { id: 't6', name: 'Maria Garcia', handle: '$mariagarcia', amount: 35, note: 'Movie night', date: 'Jun 18', isPending: false, seed: 'maria-lp', bg: 'ede9fe' },
  { id: 't7', name: 'Jordan Lee', handle: '$jordanlee', amount: -12, note: 'Lunch', date: 'Jun 17', isPending: false, seed: 'jordan-lp', bg: 'fce7f3' },
]

export const SPENDING_DATA = [
  { label: 'Food', value: 114, color: 'var(--primary)' },
  { label: 'Fun', value: 27, color: 'var(--info)' },
  { label: 'Travel', value: 15, color: 'var(--warning)' },
  { label: 'Other', value: 20, color: '#8b5cf6' },
]

export const SAMPLE_QUERIES = [
  'Send €20 to Maria',
  'Request €50 from Jordan',
  'How much did I spend this week?',
]

// ─── Intent parsing ───────────────────────────────────────────────────────────
const CUR = '(?:dollars?|euros?|pounds?|bucks?|usd|eur|gbp)?'
const NOTE = '(?:\\s+(?:for|,)\\s+(.+?))?'
const PAYMENT_RE = new RegExp(
  `(?:send|pay)\\s+[€$£]?\\s*(\\d+(?:[.,]\\d+)?)\\s*${CUR}\\s+to\\s+([a-z]+)${NOTE}[.!?]*$`,
  'i',
)
const REQUEST_RE = new RegExp(
  `request\\s+[€$£]?\\s*(\\d+(?:[.,]\\d+)?)\\s*${CUR}\\s+from\\s+([a-z]+)${NOTE}[.!?]*$`,
  'i',
)
const SPEND_RE = /spend|spending|budget|how much|cost/i

/**
 * Parses a natural-language chat message into a send/request/spending
 * intent for the AI assistant, or null if nothing matched.
 * @param {string} text
 * @returns {{type: 'send'|'request', amount: number, name: string, note: string}|{type: 'spending', amount: 0, name: ''}|null}
 */
export function parseIntent(text) {
  const pm = text.match(PAYMENT_RE)
  if (pm)
    return { type: 'send', amount: parseFloat(pm[1].replace(',', '.')), name: pm[2], note: (pm[3] || '').trim() }
  const rm = text.match(REQUEST_RE)
  if (rm)
    return { type: 'request', amount: parseFloat(rm[1].replace(',', '.')), name: rm[2], note: (rm[3] || '').trim() }
  if (SPEND_RE.test(text)) return { type: 'spending', amount: 0, name: '' }
  return null
}

/**
 * Finds a contact whose name starts with the given (case-insensitive) name.
 * @param {string} name
 * @returns {object|null}
 */
export function findContact(name) {
  return CONTACTS.find((c) => c.name.toLowerCase().startsWith(name.toLowerCase())) ?? null
}
