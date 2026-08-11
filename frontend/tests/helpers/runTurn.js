import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { compileGraph } from '@/lib/ai/graph'
import { makeStubTools } from './stubTools'

const toMessage = (m) => (m.role === 'assistant' ? new AIMessage(m.text) : new HumanMessage(m.text))

// Off by default so the pre-commit run stays quiet; set EVAL_VERBOSE=1 to read what the model did.
const IS_VERBOSE = Boolean(process.env.EVAL_VERBOSE)

/** Print one turn as a transcript: what was asked, which tools ran with what, and the reply. */
function logTurn(message, { reply, calls, drafts, charts }) {
  const lines = [`\n  user      ${message}`]
  for (const c of calls) {
    lines.push(`  tool      ${c.name}(${JSON.stringify(c.args)})`)
    for (const row of (c.output ?? '').split('\n')) lines.push(`    ->      ${row}`)
  }
  for (const d of drafts) lines.push(`  draft     ${JSON.stringify(d)}`)
  for (const c of charts) lines.push(`  chart     ${c.title} (${c.rows.length} rows)`)
  lines.push(`  assistant ${reply || '(empty)'}\n`)
  console.log(lines.join('\n'))
}

/**
 * Run one assistant turn through the real graph and model with stub tools. Returns what the app acts
 * on: the reply, the tool calls with their output, and the drafts and charts the tools collected.
 * @param {string} message - The user's message.
 * @param {{history?: {role: string, text: string}[], isOnline?: boolean, data?: object}} [options]
 * @returns {Promise<{reply: string, calls: {name: string, args: object, output: string}[], drafts: object[], charts: object[]}>}
 */
export async function runTurn(message, { history = [], isOnline = true, data } = {}) {
  const drafts = []
  const charts = []
  const calls = []
  const tools = makeStubTools({ drafts, charts, calls, data, isOnline })
  const graph = compileGraph(tools, { isOnline })
  const messages = [...history.map(toMessage), new HumanMessage(message)]
  const result = await graph.invoke({ messages })
  const last = result.messages.at(-1)
  const reply = typeof last?.content === 'string' ? last.content : ''
  const turn = { reply, calls, drafts, charts }
  if (IS_VERBOSE) logTurn(message, turn)
  return turn
}
