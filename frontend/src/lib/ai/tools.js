import 'server-only'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import {
  getAccounts,
  getContacts,
  getSpendingByContact,
  getTransactions,
  searchTransactions,
} from '@/lib/wallet/actions'
import { getMcpTools, parseMcpResult } from './mcp'

const money = (n, currency = 'EUR') => `${currency} ${Math.abs(n).toFixed(2)}`

// The inline card fits about this many bars before it stops being glanceable.
const CHART_MAX_ROWS = 6
const SEARCH_LIMIT = 10

const dayOf = (value) => {
  const d = value ? new Date(value) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown date'
}

// One set of model-facing contracts. The local and MCP-backed implementations share them, so
// which transport served a turn is invisible to the model.
const CONTRACTS = {
  balance: {
    name: 'get_balance',
    description: "The user's account balances. Use for 'how much do I have', 'what's my balance'.",
    schema: z.object({}),
  },
  contacts: {
    name: 'list_contacts',
    description:
      "The user's saved contacts. Use to resolve who they mean before sending or requesting money.",
    schema: z.object({}),
  },
  spending: {
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
  search: {
    name: 'search_transactions',
    description:
      "Find transactions by what they were for, matched on meaning rather than exact words. Use " +
      "for 'what did I spend on food', 'find the rent payment'. For totals, use " +
      'get_spending_by_contact instead.',
    schema: z.object({ query: z.string().describe('What to look for, e.g. "coffee" or "rent"') }),
  },
  recent: {
    name: 'list_recent_transactions',
    description:
      "The user's most recent transactions, newest first. Use for 'what did I do lately'. For what " +
      'a payment was for, use search_transactions.',
    schema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
  },
  draft: {
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
}

/** Record a spending breakdown for the inline chart card. */
function pushChart(charts, direction, rows) {
  charts.push({
    title: direction === 'received' ? 'Received by contact' : 'Sent by contact',
    rows: rows.slice(0, CHART_MAX_ROWS).map((r) => ({ label: r.contact, value: r.total })),
  })
}

/**
 * Balances always come from Leafy Pay (or the device cache offline) - the MCP server is
 * read-only over Atlas and deliberately holds no Leafy Pay credentials.
 */
function buildBalanceTool(isOnline) {
  return tool(async () => {
    const accounts = await getAccounts(isOnline)
    if (accounts.length === 0) return 'No accounts found.'
    return accounts
      .map((a) => `${a.label} (••••${a.last4}): ${money(a.balanceValue, a.currency)}`)
      .join('\n')
  }, CONTRACTS.balance)
}

/** Drafting is UI work, not data access: it resolves the contact and emits a confirmation card. */
function buildDraftTool(isOnline, drafts) {
  return tool(async ({ contact_name, amount, note, mode }) => {
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
  }, CONTRACTS.draft)
}

/** The offline read tools: the on-device ObjectBox store, including its HNSW vector search. */
function buildOfflineReadTools(charts) {
  const listContacts = tool(async () => {
    const contacts = await getContacts(false)
    if (contacts.length === 0) return 'No saved contacts.'
    return contacts.map((c) => `${c.name} (${c.lookupHint})`).join('\n')
  }, CONTRACTS.contacts)

  const spendingByContact = tool(async ({ direction }) => {
    const rows = await getSpendingByContact(false, direction)
    if (rows.length === 0) return 'No activity yet.'
    pushChart(charts, direction, rows)
    const verb = direction === 'received' ? 'received from' : 'sent to'
    return rows
      .map((r) => `${verb} ${r.contact}: ${money(r.total, r.currency)} across ${r.count} payment(s)`)
      .join('\n')
  }, CONTRACTS.spending)

  const searchTx = tool(async ({ query }) => {
    const rows = await searchTransactions(query, false)
    if (rows.length === 0) return 'No matching transactions.'
    return rows
      .map((t) => `${t.date}: ${money(t.amount, t.currency)} ${t.amount > 0 ? 'from' : 'to'} ${t.name} - ${t.note}`)
      .join('\n')
  }, CONTRACTS.search)

  const recentTx = tool(async ({ limit }) => {
    const rows = (await getTransactions(false)).slice(0, limit)
    if (rows.length === 0) return 'No transactions yet.'
    return rows
      .map(
        (t) =>
          `${t.date}: ${money(t.amount, t.currency)} ${t.amount > 0 ? 'from' : 'to'} ${t.name}` +
          `${t.isPending ? ' (pending)' : ''}`,
      )
      .join('\n')
  }, CONTRACTS.recent)

  return [listContacts, spendingByContact, searchTx, recentTx]
}

/**
 * The read tools backed by the backend's MCP server - the online path. Each wrapper injects the
 * session's `owner_party_ref` itself so the model can never pick whose data it reads, then
 * reformats the raw documents into the same text shape the local tools produce.
 * @param {Map<string, object>} mcp - MCP tools by name.
 * @param {string} owner - The session's `sub`.
 * @param {object[]} charts
 */
function buildMcpReadTools(mcp, owner, charts) {
  const call = async (name, args) => parseMcpResult(await mcp.get(name).invoke({ ...args, owner_party_ref: owner }))

  const listContacts = tool(async () => {
    const rows = await call('get_contacts', {})
    if (rows.length === 0) return 'No saved contacts.'
    return rows.map((c) => `${c.counterpartyLabel} (${c.counterpartyLookupHint})`).join('\n')
  }, CONTRACTS.contacts)

  const spendingByContact = tool(async ({ direction }) => {
    const rows = await call('get_spending_by_contact', { direction })
    if (rows.length === 0) return 'No activity yet.'
    pushChart(charts, direction, rows)
    const verb = direction === 'received' ? 'received from' : 'sent to'
    return rows
      .map((r) => `${verb} ${r.contact}: ${money(r.total, r.currency)} across ${r.count} payment(s)`)
      .join('\n')
  }, CONTRACTS.spending)

  const searchTx = tool(async ({ query }) => {
    const rows = await call('search_transactions', { q: query, limit: SEARCH_LIMIT })
    if (rows.length === 0) return 'No matching transactions.'
    return rows
      .map((t) => `${dayOf(t.createdAt)}: ${money(t.amount)} ${t.direction === 'received' ? 'received' : 'sent'} - ${t.note || 'no note'}`)
      .join('\n')
  }, CONTRACTS.search)

  const recentTx = tool(async ({ limit }) => {
    const rows = await call('list_transactions', { limit })
    if (rows.length === 0) return 'No transactions yet.'
    return rows
      .map((t) => `${dayOf(t.createdAt)}: ${money(t.amount)} ${t.direction === 'received' ? 'received' : 'sent'} - ${t.note || 'no note'}`)
      .join('\n')
  }, CONTRACTS.recent)

  return [listContacts, spendingByContact, searchTx, recentTx]
}

/**
 * The assistant's tools, bound to a connection state. Online, reads go through the backend's
 * MCP server; offline they read the on-device store. Balance and drafting are always native.
 * @param {boolean} isOnline
 * @param {object[]} [drafts] - `draft_payment` pushes proposals here; the caller renders them for
 *   confirmation. No tool moves money - that needs the user.
 * @param {object[]} [charts] - `get_spending_by_contact` pushes a breakdown here; the caller
 *   renders it as an inline chart card alongside the reply.
 */
export async function walletTools(isOnline, drafts = [], charts = []) {
  const getBalance = buildBalanceTool(isOnline)
  const draftPayment = buildDraftTool(isOnline, drafts)

  if (!isOnline) return [getBalance, ...buildOfflineReadTools(charts), draftPayment]

  const [mcp, session] = await Promise.all([getMcpTools(), getSession()])
  return [getBalance, ...buildMcpReadTools(mcp, session.sub, charts), draftPayment]
}
