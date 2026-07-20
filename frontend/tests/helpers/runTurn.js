import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { compileGraph } from '@/lib/ai/graph'
import { makeStubTools } from './stubTools'

const toMessage = (m) => (m.role === 'assistant' ? new AIMessage(m.text) : new HumanMessage(m.text))

/**
 * Run one assistant turn through the real graph and the real local model, with stub tools. Returns
 * everything the app acts on: the final reply text, the tool calls the model made, and the drafts
 * and charts the tools collected.
 * @param {string} message - The user's message.
 * @param {{history?: {role: string, text: string}[], isOnline?: boolean, data?: object}} [options]
 * @returns {Promise<{reply: string, calls: {name: string, args: object}[], drafts: object[], charts: object[]}>}
 */
export async function runTurn(message, { history = [], isOnline = true, data } = {}) {
  const drafts = []
  const charts = []
  const calls = []
  const tools = makeStubTools({ drafts, charts, calls, data })
  const graph = compileGraph(tools, { isOnline })
  const messages = [...history.map(toMessage), new HumanMessage(message)]
  const result = await graph.invoke({ messages })
  const last = result.messages.at(-1)
  const reply = typeof last?.content === 'string' ? last.content : ''
  return { reply, calls, drafts, charts }
}
