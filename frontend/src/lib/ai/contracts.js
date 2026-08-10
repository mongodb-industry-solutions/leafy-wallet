import { z } from 'zod'

// One set of model-facing tool contracts (name, description, schema). The local and MCP-backed
// implementations in tools.js share them, so which transport served a turn is invisible to the
// model. Kept free of server-only imports so the eval harness can build stub tools from the exact
// same contracts the app ships.
export const CONTRACTS = {
  balance: {
    name: 'get_balance',
    description: "The user's account balances. Use for 'how much do I have', 'what's my balance'.",
    schema: z.object({}),
  },
  velocity: {
    name: 'get_transaction_velocity',
    description:
      "Bursts of payments sent in quick succession, which can mean a compromised account. Use for " +
      "'anything unusual', 'suspicious activity', 'did anyone use my account'. Online only: the " +
      'device cannot compute this. An empty result means nothing unusual was found.',
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
      "How much the user spent and to whom, already totaled per contact, largest first. Use for " +
      "'how much did I spend', 'how much did I spend this week', 'where did my money go', 'who do " +
      "I send the most to', 'how much have I sent Luis'.",
    schema: z.object({
      direction: z
        .enum(['sent', 'received'])
        .default('sent')
        .describe('sent = money out, received = money in'),
    }),
  },
  spendingByCategory: {
    name: 'get_spending_by_category',
    description:
      "The user's spending grouped into categories (Dining, Groceries, Transport, Bills, " +
      "Entertainment, ...), largest first, already totaled. Use for 'what are my spending " +
      "categories', 'break down my spending by category', 'what do I spend the most on'.",
    schema: z.object({}),
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
      'Draft a payment or request when the user asks to send or request money. The user reviews and ' +
      'confirms it on a card. Resolve the contact from list_contacts first if the name is ambiguous. ' +
      "For example, 'send 20 to Sofia for rent' calls this with contact_name 'Sofia', amount 20, " +
      "note 'rent', mode 'send'.",
    schema: z.object({
      contact_name: z.string().describe('Who to pay or ask, as the user said it'),
      amount: z.number().positive().describe('Amount in euros'),
      note: z.string().optional().describe("What it's for, as a bare phrase like \"team dinner\""),
      mode: z.enum(['send', 'request']).describe('send = money out, request = ask them to pay'),
    }),
  },
}
