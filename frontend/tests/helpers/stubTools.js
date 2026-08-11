import { tool } from '@langchain/core/tools'
import { CONTRACTS } from '@/lib/ai/contracts'
import {
  cleanNote,
  formatCategory,
  formatSpending,
  formatVelocity,
  money,
  noteGuardMessage,
  pushCategoryChart,
  pushSpendingChart,
  pushVelocityChart,
  resolveDraft,
} from '@/lib/ai/toolkit'

const SEARCH_LIMIT = 4
// A lexical hit outranks any embedding match, which is what $rankFusion's exact-term branch buys.
const LEXICAL_WEIGHT = 10
// Query words below this length, plus these, are too common to be evidence of a lexical match.
const MIN_LEXICAL_LENGTH = 4
const STOPWORDS = new Set(['much', 'spend', 'spent', 'find', 'show', 'that', 'this', 'what', 'when', 'with', 'from', 'have', 'about', 'anything', 'payment', 'payments'])

const words = (text) => text.toLowerCase().match(/[a-z0-9-]+/g) ?? []

/**
 * Stand-in for the device's HNSW query: rank by how many of the query's words a row's tags cover.
 * Like `nearestNeighbors` it has no score floor, so it returns its k nearest, relevant or not.
 */
function vectorRank(rows, query) {
  const q = words(query)
  return rows
    .map((row) => ({ row, score: row.terms.filter((t) => q.includes(t)).length }))
    .sort((a, b) => b.score - a.score || b.row.date.localeCompare(a.row.date))
}

/**
 * Stand-in for $rankFusion: the lexical branch scores exact term hits in the note or counterparty,
 * which is what lifts a row like an invoice reference above rows whose embeddings match better.
 */
function hybridRank(rows, query) {
  const terms = words(query).filter((w) => w.length >= MIN_LEXICAL_LENGTH && !STOPWORDS.has(w))
  return vectorRank(rows, query)
    .map(({ row, score }) => {
      const haystack = `${row.note} ${row.name}`.toLowerCase()
      const hits = terms.filter((w) => haystack.includes(w)).length
      return { row, score: score + hits * LEXICAL_WEIGHT }
    })
    .sort((a, b) => b.score - a.score || b.row.date.localeCompare(a.row.date))
}

// Deterministic wallet data for the evals, so assertions are stable across runs.
export const STUB_DATA = {
  accounts: [{ label: 'Everyday', last4: '1234', balanceValue: 1493.75, currency: 'EUR' }],
  contacts: [
    { name: 'Luis (Colleague)', reference: 'ben-luis', lookupHint: 'l***@back.es' },
    { name: 'Priya Patel', reference: 'ben-priya', lookupHint: 'p***@back.es' },
    { name: 'Sofia (Flatmate)', reference: 'ben-sofia', lookupHint: 's***@back.es' },
  ],
  spending: {
    sent: [
      { contact: 'Luis (Colleague)', total: 80.23, count: 3, currency: 'EUR' },
      { contact: 'Sofia (Flatmate)', total: 74.5, count: 2, currency: 'EUR' },
      { contact: 'Priya Patel', total: 40.93, count: 1, currency: 'EUR' },
    ],
    received: [{ contact: 'Luis (Colleague)', total: 55.0, count: 1, currency: 'EUR' }],
  },
  categories: [
    { category: 'Bills & Utilities', emoji: '🧾', total: 120.0, count: 1, currency: 'EUR' },
    { category: 'Dining', emoji: '🍽️', total: 62.5, count: 4, currency: 'EUR' },
    { category: 'Transport', emoji: '🚕', total: 28.3, count: 3, currency: 'EUR' },
  ],
  // `onDevice: false` rows are the long tail: aged out of ObjectBox, still in Atlas history.
  transactions: [
    { date: '2026-07-21', amount: -9.9, currency: 'EUR', name: 'Sofia (Flatmate)', note: 'shared streaming plan', terms: ['streaming', 'subscription', 'entertainment'], onDevice: true },
    { date: '2026-07-20', amount: -31.5, currency: 'EUR', name: 'Priya Patel', note: 'taxi to the airport', terms: ['taxi', 'transport', 'ride', 'airport'], onDevice: true },
    { date: '2026-07-19', amount: -20, currency: 'EUR', name: 'Luis (Colleague)', note: 'lunch at the ramen place', terms: ['lunch', 'food', 'dining', 'ramen'], onDevice: true },
    { date: '2026-07-18', amount: 55, currency: 'EUR', name: 'Luis (Colleague)', note: 'concert ticket refund', terms: ['concert', 'refund', 'entertainment'], onDevice: true },
    { date: '2026-07-15', amount: -4.5, currency: 'EUR', name: 'Cafe Central', note: 'morning coffee', terms: ['coffee', 'food', 'dining'], onDevice: true },
    { date: '2026-07-02', amount: -120, currency: 'EUR', name: 'Sofia (Flatmate)', note: 'July rent, invoice INV-2291', terms: ['rent', 'bills', 'housing'], onDevice: true },
    { date: '2026-01-08', amount: -64.9, currency: 'EUR', name: 'Priya Patel', note: 'ski cabin deposit for the winter trip', terms: ['travel', 'trip', 'holiday'], onDevice: false },
    { date: '2025-11-21', amount: -12.99, currency: 'EUR', name: 'Cafe Central', note: 'coffee beans subscription', terms: ['coffee', 'food'], onDevice: false },
  ],
  // The shape services/fraud.py returns: a burst of sends inside one window, newest first.
  velocity: [
    { createdAt: '2026-07-21T14:32:00.000Z', amount: 240, currency: 'EUR', note: 'gift cards', sendsInWindow: 4, valueInWindow: 690 },
    { createdAt: '2026-07-21T14:28:00.000Z', amount: 180, currency: 'EUR', note: 'gift cards', sendsInWindow: 3, valueInWindow: 450 },
    { createdAt: '2026-07-21T14:25:00.000Z', amount: 200, currency: 'EUR', note: 'transfer', sendsInWindow: 3, valueInWindow: 270 },
  ],
}

const line = (t) => `${t.date}: ${money(t.amount)} ${t.amount > 0 ? 'from' : 'to'} ${t.name} - ${t.note}`

/**
 * The assistant's tool set over stub data, built from the CONTRACTS the app ships. Mirrors tools.js:
 * online sees Atlas history and hybrid ranking, offline only ObjectBox, and velocity is online-only.
 * @param {{drafts: object[], charts: object[], calls: object[], data?: object, isOnline?: boolean}} sinks
 */
export function makeStubTools({ drafts, charts, calls, data = STUB_DATA, isOnline = true }) {
  const visible = data.transactions.filter((t) => isOnline || t.onDevice)
  const record = (name, args, output) => {
    calls.push({ name, args, output })
    return output
  }

  const getBalance = tool(async () => {
    const text = data.accounts.map((a) => `${a.label} (••••${a.last4}): ${money(a.balanceValue)}`).join('\n')
    return record('get_balance', {}, text)
  }, CONTRACTS.balance)

  const listContacts = tool(async () => {
    const text = data.contacts.map((c) => `${c.name} (${c.lookupHint})`).join('\n')
    return record('list_contacts', {}, text)
  }, CONTRACTS.contacts)

  const spendingByContact = tool(async ({ direction }) => {
    const rows = data.spending[direction] ?? []
    if (rows.length === 0) return record('get_spending_by_contact', { direction }, 'No activity yet.')
    pushSpendingChart(charts, direction, rows)
    return record('get_spending_by_contact', { direction }, formatSpending(rows, direction))
  }, CONTRACTS.spending)

  const spendingByCategory = tool(async () => {
    const rows = data.categories ?? []
    if (rows.length === 0) return record('get_spending_by_category', {}, 'No spending yet.')
    pushCategoryChart(charts, rows)
    return record('get_spending_by_category', {}, formatCategory(rows))
  }, CONTRACTS.spendingByCategory)

  const searchTx = tool(async ({ query }) => {
    const ranked = isOnline ? hybridRank(visible, query) : vectorRank(visible, query)
    const rows = ranked.slice(0, SEARCH_LIMIT).map((r) => r.row)
    if (rows.length === 0) return record('search_transactions', { query }, 'No matching transactions.')
    return record('search_transactions', { query }, rows.map(line).join('\n'))
  }, CONTRACTS.search)

  const recentTx = tool(async ({ limit }) => {
    const rows = [...visible].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
    if (rows.length === 0) return record('list_recent_transactions', { limit }, 'No transactions yet.')
    return record('list_recent_transactions', { limit }, rows.map(line).join('\n'))
  }, CONTRACTS.recent)

  const velocity = tool(async () => {
    const rows = data.velocity ?? []
    if (rows.length === 0) return record('get_transaction_velocity', {}, 'No unusual payment bursts found.')
    pushVelocityChart(charts, rows)
    return record('get_transaction_velocity', {}, formatVelocity(rows))
  }, CONTRACTS.velocity)

  const draftPayment = tool(async ({ contact_name, amount, note, mode }) => {
    const args = { contact_name, amount, note, mode }
    const cleaned = cleanNote(note)
    if (!cleaned) return record('draft_payment', args, noteGuardMessage(mode))
    return record('draft_payment', args, resolveDraft(data.contacts, { ...args, note: cleaned }, drafts))
  }, CONTRACTS.draft)

  const tools = [getBalance, listContacts, spendingByContact, spendingByCategory, searchTx, recentTx, draftPayment]
  return isOnline ? [...tools, velocity] : tools
}
