import 'server-only'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import {
  getAccounts,
  getContacts,
  getSpendingByContact,
  getTransactions,
  searchTransactions,
} from '@/lib/wallet/actions'

const money = (n, currency = 'EUR') => `${currency} ${Math.abs(n).toFixed(2)}`

// The inline card fits about this many bars before it stops being glanceable.
const CHART_MAX_ROWS = 6

/**
 * The assistant's tools, bound to a connection state.
 * @param {boolean} isOnline - Picks each tool's source (Leafy Pay ∥ Atlas, or the device).
 * @param {object[]} [drafts] - `draft_payment` pushes proposals here; the caller renders them for
 *   confirmation. No tool moves money - that needs the user.
 * @param {object[]} [charts] - `get_spending_by_contact` pushes a breakdown here; the caller
 *   renders it as an inline chart card alongside the reply.
 */
export function walletTools(isOnline, drafts = [], charts = []) {
  const getBalance = tool(
    async () => {
      const accounts = await getAccounts(isOnline)
      if (accounts.length === 0) return 'No accounts found.'
      return accounts
        .map((a) => `${a.label} (••••${a.last4}): ${money(a.balanceValue, a.currency)}`)
        .join('\n')
    },
    {
      name: 'get_balance',
      description: "The user's account balances. Use for 'how much do I have', 'what's my balance'.",
      schema: z.object({}),
    },
  )

  const listContacts = tool(
    async () => {
      const contacts = await getContacts(isOnline)
      if (contacts.length === 0) return 'No saved contacts.'
      return contacts.map((c) => `${c.name} (${c.lookupHint})`).join('\n')
    },
    {
      name: 'list_contacts',
      description:
        "The user's saved contacts. Use to resolve who they mean before sending or requesting money.",
      schema: z.object({}),
    },
  )

  const spendingByContact = tool(
    async ({ direction }) => {
      const rows = await getSpendingByContact(isOnline, direction)
      if (rows.length === 0) return 'No activity yet.'
      charts.push({
        title: direction === 'received' ? 'Received by contact' : 'Sent by contact',
        rows: rows.slice(0, CHART_MAX_ROWS).map((r) => ({ label: r.contact, value: r.total })),
      })
      const verb = direction === 'received' ? 'received from' : 'sent to'
      return rows
        .map((r) => `${verb} ${r.contact}: ${money(r.total, r.currency)} across ${r.count} payment(s)`)
        .join('\n')
    },
    {
      name: 'get_spending_by_contact',
      description:
        "Totals per contact, largest first. Use for aggregates: 'where did my money go', 'who do I " +
        "send the most to', 'how much have I sent Luis'. Totals are already computed - never add up " +
        'transactions yourself.',
      schema: z.object({
        direction: z
          .enum(['sent', 'received'])
          .default('sent')
          .describe('sent = money out, received = money in'),
      }),
    },
  )

  const searchTx = tool(
    async ({ query }) => {
      const rows = await searchTransactions(query, isOnline)
      if (rows.length === 0) return 'No matching transactions.'
      return rows
        .map((t) => `${t.date}: ${money(t.amount, t.currency)} ${t.amount > 0 ? 'from' : 'to'} ${t.name} - ${t.note}`)
        .join('\n')
    },
    {
      name: 'search_transactions',
      description:
        "Find transactions by what they were for, matched on meaning rather than exact words. Use " +
        "for 'what did I spend on food', 'find the rent payment'. For totals, use " +
        'get_spending_by_contact instead.',
      schema: z.object({ query: z.string().describe('What to look for, e.g. "coffee" or "rent"') }),
    },
  )

  const recentTx = tool(
    async ({ limit }) => {
      const rows = (await getTransactions(isOnline)).slice(0, limit)
      if (rows.length === 0) return 'No transactions yet.'
      return rows
        .map(
          (t) =>
            `${t.date}: ${money(t.amount, t.currency)} ${t.amount > 0 ? 'from' : 'to'} ${t.name}` +
            `${t.isPending ? ' (pending)' : ''}`,
        )
        .join('\n')
    },
    {
      name: 'list_recent_transactions',
      description:
        "The user's most recent transactions, newest first. Use for 'what did I do lately'. For what " +
        'a payment was for, use search_transactions.',
      schema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
    },
  )

  const draftPayment = tool(
    async ({ contact_name, amount, note, mode }) => {
      const contacts = await getContacts(isOnline)
      const needle = contact_name.trim().toLowerCase()
      const match =
        contacts.find((c) => c.name.toLowerCase() === needle) ??
        contacts.find((c) => c.name.toLowerCase().includes(needle))
      if (!match) {
        const names = contacts.map((c) => c.name).join(', ')
        return `No contact matches "${contact_name}". Saved contacts: ${names || 'none'}.`
      }
      drafts.push({ contact: match, amount, note: note ?? '', mode })
      return `Drafted a ${mode} of ${money(amount)} ${mode === 'request' ? 'from' : 'to'} ${match.name}. It is shown to the user for confirmation. It has NOT been sent. Tell them to review and confirm it.`
    },
    {
      name: 'draft_payment',
      description:
        "Draft a payment or request for the user to confirm. Use when they ask to send or request " +
        "money ('send 20 to Luis', 'ask Priya for 15'). This only drafts - the user confirms before " +
        'anything moves. Resolve the contact from list_contacts first if the name is ambiguous.',
      schema: z.object({
        contact_name: z.string().describe('Who to pay or ask, as the user said it'),
        amount: z.number().positive().describe('Amount in euros'),
        note: z.string().optional().describe("What it's for, if the user said"),
        mode: z.enum(['send', 'request']).describe('send = money out, request = ask them to pay'),
      }),
    },
  )

  return [getBalance, listContacts, spendingByContact, searchTx, recentTx, draftPayment]
}
