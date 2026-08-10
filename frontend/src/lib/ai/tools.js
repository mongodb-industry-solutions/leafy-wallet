import 'server-only'
import { tool } from '@langchain/core/tools'
import { getSession } from '@/lib/auth/session'
import {
  getAccounts,
  getContacts,
  getSpendingByCategory,
  getSpendingByContact,
  getTransactions,
  searchTransactions,
} from '@/lib/wallet/actions'
import { CONTRACTS } from './contracts'
import { getMcpTools, parseMcpResult } from './mcp'
import {
  cleanNote,
  formatCategory,
  formatSpending,
  money,
  noteGuardMessage,
  pushCategoryChart,
  pushSpendingChart,
  resolveDraft,
} from './toolkit'

const SEARCH_LIMIT = 10

const dayOf = (value) => {
  const d = value ? new Date(value) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown date'
}

// One MCP transaction document as a line of text, the shape the offline tools also produce.
const toMcpRow = (t) =>
  `${dayOf(t.createdAt)}: ${money(t.amount)} ${t.direction === 'received' ? 'received' : 'sent'} - ${t.note || 'no note'}`

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

/**
 * Spending grouped by category (Dining, Bills, ...). Transport-agnostic: the action reads from Leafy
 * Pay/Atlas online or the device offline and classifies notes with the same embedding model either
 * way, so this one tool serves both. Pushes a chart alongside the reply.
 */
function buildSpendingByCategoryTool(isOnline, charts) {
  return tool(async () => {
    const rows = await getSpendingByCategory(isOnline)
    if (rows.length === 0) return 'No spending yet.'
    pushCategoryChart(charts, rows)
    return formatCategory(rows)
  }, CONTRACTS.spendingByCategory)
}

/** Drafting is UI work, not data access: it resolves the contact and emits a confirmation card. */
function buildDraftTool(isOnline, drafts) {
  return tool(async ({ contact_name, amount, note, mode }) => {
    const cleaned = cleanNote(note)
    if (!cleaned) return noteGuardMessage(mode)
    const contacts = await getContacts(isOnline)
    return resolveDraft(contacts, { contact_name, amount, note: cleaned, mode }, drafts)
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
    pushSpendingChart(charts, direction, rows)
    return formatSpending(rows, direction)
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
    pushSpendingChart(charts, direction, rows)
    return formatSpending(rows, direction)
  }, CONTRACTS.spending)

  const searchTx = tool(async ({ query }) => {
    const rows = await call('search_transactions', { q: query, limit: SEARCH_LIMIT })
    if (rows.length === 0) return 'No matching transactions.'
    return rows.map(toMcpRow).join('\n')
  }, CONTRACTS.search)

  const recentTx = tool(async ({ limit }) => {
    const rows = await call('list_transactions', { limit })
    if (rows.length === 0) return 'No transactions yet.'
    return rows.map(toMcpRow).join('\n')
  }, CONTRACTS.recent)

  // No offline twin: the window aggregation behind it has no ObjectBox equivalent.
  const velocity = tool(async () => {
    const rows = await call('get_transaction_velocity', {})
    if (rows.length === 0) return 'No unusual payment bursts found.'
    return rows
      .map((t) => `${dayOf(t.createdAt)}: ${money(t.amount)} sent, ${t.sendsInWindow} payments in the surrounding window`)
      .join('\n')
  }, CONTRACTS.velocity)

  return [listContacts, spendingByContact, searchTx, recentTx, velocity]
}

/**
 * The assistant's tools, bound to a connection state. Online, reads go through the backend's
 * MCP server; offline they read the on-device store. Balance and drafting are always native.
 * @param {boolean} isOnline
 * @param {object[]} drafts - `draft_payment` pushes proposals here; the caller renders them for
 *   confirmation. No tool moves money - that needs the user.
 * @param {object[]} charts - `get_spending_by_contact` pushes a breakdown here; the caller
 *   renders it as an inline chart card alongside the reply.
 * @param {string} [owner] - The session's `sub`, whose data the MCP reads are scoped to. Pass it in
 *   from a route that already read the session; omitted, it is read here.
 */
export async function walletTools(isOnline, drafts, charts, owner) {
  const getBalance = buildBalanceTool(isOnline)
  const spendingByCategory = buildSpendingByCategoryTool(isOnline, charts)
  const draftPayment = buildDraftTool(isOnline, drafts)

  if (!isOnline) {
    return [getBalance, ...buildOfflineReadTools(charts), spendingByCategory, draftPayment]
  }

  const [mcp, ownerPartyRef] = await Promise.all([
    getMcpTools(),
    owner ?? getSession().then((s) => s?.sub),
  ])
  return [getBalance, ...buildMcpReadTools(mcp, ownerPartyRef, charts), spendingByCategory, draftPayment]
}
