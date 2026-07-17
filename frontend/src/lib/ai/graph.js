import 'server-only'
import { ChatOllama } from '@langchain/ollama'
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { SystemMessage } from '@langchain/core/messages'
import { walletTools } from './tools'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
// 3b over 7b: a CPU-bound local demo needs snappy replies more than marginal answer quality.
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:3b'

// The model sizes context from VRAM, and the container reports none - without this it defaults to
// 4096, which the system prompt and a couple of tool results exhaust.
const NUM_CTX = 8192

const SYSTEM_PROMPT = `You are Leafy, the assistant inside the Leafy Wallet app. You help the signed-in user understand and move their own money: balances, contacts, past payments, and spending. Amounts are in euros.

## Instructions
- Answer from tool results; call a tool whenever the answer depends on the user's data. If the tools don't provide the answer, say so.
- For totals and "how much" questions, use get_spending_by_contact and read its numbers as they are.
- Reply in one or two short sentences, warm and plain-spoken, leading with the number or fact the user asked for.
- Keep going until the user's question is fully answered before ending your turn.

## Sending and requesting money
- When the user asks to send or request money, call draft_payment, then tell them in one line to review and confirm the card.
- A draft stays pending until the user confirms it on the card; describe it as awaiting their confirmation.`

const OFFLINE_NOTE = `The device is offline. You are reading a local copy that syncs when the connection returns, so recent activity may be missing and balances are as of the last connection. Say so if it matters to the answer.`

/**
 * The assistant's graph: the model either answers or calls a tool, and loops until it answers.
 * Async because the online tool set is loaded from the backend's MCP server.
 * @param {boolean} isOnline - Passed to the tools, which pick their own source from it.
 * @param {object[]} [drafts] - Collects any payment the model drafts for confirmation.
 * @param {object[]} [charts] - Collects any spending breakdown a tool produces for inline display.
 */
export async function buildGraph(isOnline, drafts = [], charts = []) {
  const tools = await walletTools(isOnline, drafts, charts)
  const model = new ChatOllama({
    baseUrl: OLLAMA_URL,
    model: CHAT_MODEL,
    numCtx: NUM_CTX,
    temperature: 0,
  }).bindTools(tools)

  async function callModel(state) {
    const system = new SystemMessage(isOnline ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\n${OFFLINE_NOTE}`)
    const reply = await model.invoke([system, ...state.messages])
    return { messages: [reply] }
  }

  const shouldContinue = (state) => {
    const last = state.messages.at(-1)
    return last?.tool_calls?.length ? 'tools' : '__end__'
  }

  return new StateGraph(MessagesAnnotation)
    .addNode('model', callModel)
    .addNode('tools', new ToolNode(tools))
    .addEdge('__start__', 'model')
    .addConditionalEdges('model', shouldContinue, ['tools', '__end__'])
    .addEdge('tools', 'model')
    .compile()
}
