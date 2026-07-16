import 'server-only'
import { ChatOllama } from '@langchain/ollama'
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { SystemMessage } from '@langchain/core/messages'
import { walletTools } from './tools'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b'

// The model sizes context from VRAM, and the container reports none — without this it defaults to
// 4096, which the system prompt and a couple of tool results exhaust.
const NUM_CTX = 8192

const SYSTEM_PROMPT = `You are Leafy, the assistant inside the Leafy Wallet app. You help with the user's own money: balances, contacts, past payments, and spending.

Answer from tools, never from memory — you cannot see the user's data otherwise. For totals ("where did my money go", "how much have I sent X"), call get_spending_by_contact: it returns the arithmetic already done. Never add up amounts yourself.

Amounts are euros. Be brief and concrete: lead with the number the user asked for. Don't invent contacts, amounts, or dates — if a tool returns nothing, say so.

To send or request money, call draft_payment — it drafts for the user to confirm and moves nothing on its own. Never claim a payment is done.`

const OFFLINE_NOTE = `The device is offline. You are reading a local copy that syncs when the connection returns, so recent activity may be missing and balances are as of the last connection. Say so if it matters to the answer.`

/**
 * The assistant's graph: the model either answers or calls a tool, and loops until it answers.
 * @param {boolean} isOnline - Passed to the tools, which pick their own source from it.
 * @param {object[]} [drafts] - Collects any payment the model drafts for confirmation.
 */
export function buildGraph(isOnline, drafts = []) {
  const tools = walletTools(isOnline, drafts)
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
