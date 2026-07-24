import { tool } from '@langchain/core/tools'
import { CONTRACTS } from '@/lib/ai/contracts'
import {
  cleanNote,
  formatCategory,
  formatSpending,
  money,
  noteGuardMessage,
  pushCategoryChart,
  pushSpendingChart,
  resolveDraft,
} from '@/lib/ai/toolkit'

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
  recent: [
    { date: '2026-07-19', amount: -20, currency: 'EUR', name: 'Luis (Colleague)', note: 'lunch', isPending: false },
    { date: '2026-07-18', amount: 55, currency: 'EUR', name: 'Luis (Colleague)', note: 'concert', isPending: false },
  ],
  search: [{ date: '2026-07-15', amount: -4.5, currency: 'EUR', name: 'Cafe Central', note: 'coffee' }],
}

/**
 * The assistant's tool set with fake implementations over stub data, built from the exact CONTRACTS
 * the app ships and reusing the app's own `toolkit` formatting/draft logic (so the evals exercise the
 * real code, not a copy). Records every call and collects drafts/charts so evals can assert what the
 * model did, with no database or live backend.
 * @param {{drafts: object[], charts: object[], calls: {name: string, args: object}[], data?: object}} sinks
 */
export function makeStubTools({ drafts, charts, calls, data = STUB_DATA }) {
  const record = (name, args) => calls.push({ name, args })

  const getBalance = tool(async () => {
    record('get_balance', {})
    return data.accounts.map((a) => `${a.label} (••••${a.last4}): ${money(a.balanceValue)}`).join('\n')
  }, CONTRACTS.balance)

  const listContacts = tool(async () => {
    record('list_contacts', {})
    return data.contacts.map((c) => `${c.name} (${c.lookupHint})`).join('\n')
  }, CONTRACTS.contacts)

  const spendingByContact = tool(async ({ direction }) => {
    record('get_spending_by_contact', { direction })
    const rows = data.spending[direction] ?? []
    if (rows.length === 0) return 'No activity yet.'
    pushSpendingChart(charts, direction, rows)
    return formatSpending(rows, direction)
  }, CONTRACTS.spending)

  const spendingByCategory = tool(async () => {
    record('get_spending_by_category', {})
    const rows = data.categories ?? []
    if (rows.length === 0) return 'No spending yet.'
    pushCategoryChart(charts, rows)
    return formatCategory(rows)
  }, CONTRACTS.spendingByCategory)

  const searchTx = tool(async ({ query }) => {
    record('search_transactions', { query })
    const rows = data.search
    if (rows.length === 0) return 'No matching transactions.'
    return rows
      .map((t) => `${t.date}: ${money(t.amount)} ${t.amount > 0 ? 'from' : 'to'} ${t.name} - ${t.note}`)
      .join('\n')
  }, CONTRACTS.search)

  const recentTx = tool(async ({ limit }) => {
    record('list_recent_transactions', { limit })
    const rows = data.recent.slice(0, limit)
    if (rows.length === 0) return 'No transactions yet.'
    return rows
      .map((t) => `${t.date}: ${money(t.amount)} ${t.amount > 0 ? 'from' : 'to'} ${t.name}${t.isPending ? ' (pending)' : ''}`)
      .join('\n')
  }, CONTRACTS.recent)

  const draftPayment = tool(async ({ contact_name, amount, note, mode }) => {
    record('draft_payment', { contact_name, amount, note, mode })
    const cleaned = cleanNote(note)
    if (!cleaned) return noteGuardMessage(mode)
    return resolveDraft(data.contacts, { contact_name, amount, note: cleaned, mode }, drafts)
  }, CONTRACTS.draft)

  return [getBalance, listContacts, spendingByContact, spendingByCategory, searchTx, recentTx, draftPayment]
}
