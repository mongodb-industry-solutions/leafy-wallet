// Seed data (AI chat mock).
export const APP_USERS = [
  { id: 'u1', name: 'Alex Chen', email: 'alex.chen@leafymail.com', seed: 'alex-lp', bg: '60a5fa' },
  { id: 'u2', name: 'Maria Garcia', email: 'maria.garcia@leafymail.com', seed: 'maria-lp', bg: 'a78bfa' },
  { id: 'u3', name: 'Jordan Lee', email: 'jordan.lee@leafymail.com', seed: 'jordan-lp', bg: 'fb7185' },
  { id: 'u4', name: 'Sam Rivera', email: 'sam.rivera@leafymail.com', seed: 'sam-lp', bg: '34d399' },
]

// Primary account balance (EUR), numeric. Still used by the AI action-card mock (draft "remaining" math).
export const BALANCE = 12458.32

export const CONTACTS = [
  { id: 'c1', name: 'Maria Garcia', lookupType: 'email', lookupHint: 'm•••@gmail.com', seed: 'maria-lp', bg: 'ede9fe' },
  { id: 'c2', name: 'Jordan Lee', lookupType: 'phone', lookupHint: '+1 ••• 4821', seed: 'jordan-lp', bg: 'fce7f3' },
  { id: 'c3', name: 'Sam Rivera', lookupType: 'email', lookupHint: 's•••@icloud.com', seed: 'sam-lp', bg: 'dcfce7' },
  { id: 'c4', name: 'Taylor Kim', lookupType: 'phone', lookupHint: '+1 ••• 7702', seed: 'taylor-lp', bg: 'ffedd5' },
  { id: 'c5', name: 'Casey Brooks', lookupType: 'email', lookupHint: 'c•••@gmail.com', seed: 'casey-lp', bg: 'cffafe' },
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

// Intent parsing
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
