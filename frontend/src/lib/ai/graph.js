import { ChatOllama } from '@langchain/ollama'
import { ChatAnthropic } from '@langchain/anthropic'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { AIMessage, HumanMessage, SystemMessage, isAIMessage } from '@langchain/core/messages'
import { SYSTEM_PROMPT, OFFLINE_NOTE } from './prompt'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
// 7b over 3b: weaker tool-callers narrate the call instead of emitting it, so charts never render.
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b'

// The container reports no VRAM, so the model would default to 4096 and exhaust it on tool results.
const NUM_CTX = 8192
// Fixed seed so a turn is as reproducible as the runtime allows.
const SEED = 42

// Not NODE_ENV: Next pins that to `production` in any built image, including the local Docker one.
const APP_ENV = process.env.APP_ENV ?? 'local'

// Grove is MongoDB's gateway to hosted Claude, used where no Ollama chat model runs.
const GROVE_KEY = process.env.GROVE_API_KEY ?? ''
const GROVE_URL =
  process.env.GROVE_BASE_URL ??
  'https://grove-gateway-prod.azure-api.net/grove-foundry-prod/anthropic'
const GROVE_MODEL = process.env.GROVE_CHAT_MODEL ?? 'claude-haiku-4-5'
// The assistant answers in a sentence or two, so this only has to clear the longest reply.
const GROVE_MAX_TOKENS = 4096

/** The chat model for a turn: Grove once deployed, local Ollama otherwise. */
function chatModel() {
  if (APP_ENV === 'local') {
    return new ChatOllama({
      baseUrl: OLLAMA_URL,
      model: CHAT_MODEL,
      numCtx: NUM_CTX,
      temperature: 0,
      seed: SEED,
      // qwen3 reasons in a <think> block by default, which adds latency and can leak into the reply.
      ...(CHAT_MODEL.startsWith('qwen3') ? { think: false } : {}),
    })
  }
  // Fail loudly: no Ollama is deployed, so there is nothing to fall back to.
  if (!GROVE_KEY) {
    throw new Error(
      `APP_ENV is "${APP_ENV}" but GROVE_API_KEY is not set - the assistant has no model to call.`,
    )
  }
  return new ChatAnthropic({
    model: GROVE_MODEL,
    temperature: 0,
    maxTokens: GROVE_MAX_TOKENS,
    anthropicApiUrl: GROVE_URL,
    apiKey: GROVE_KEY,
    // Grove authenticates with `api-key`, not Anthropic's own `x-api-key` header.
    clientOptions: { defaultHeaders: { 'api-key': GROVE_KEY } },
  })
}

// Bullets need whitespace after the marker, so a leading "-€50" survives.
const MARKDOWN_PATTERNS = [
  [/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2'],
  [/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1'],
  [/`([^`\n]+)`/g, '$1'],
  [/^#{1,6}[ \t]+/gm, ''],
  [/^[ \t]*[-*+][ \t]+/gm, ''],
]

/**
 * Strip markdown out of an answer: the chat bubble renders text verbatim, so `**bold**` would
 * otherwise reach the user as asterisks.
 * @param {string} text
 * @returns {string}
 */
export function toPlainText(text) {
  return MARKDOWN_PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text)
}

const REASK = 'Emit that as an actual tool call, not as text.'

/**
 * Runs after every model turn: re-asks for a tool call the model wrote as prose, since that beats
 * parsing the several shapes it uses, and strips markdown from the turns that end in an answer.
 * @param {import('@langchain/core/language_models/chat_models').BaseChatModel} model - Tools bound.
 * @param {string[]} toolNames - A reply naming one of these is a narrated call, not an answer.
 * @param {SystemMessage} system - The agent's own prompt, so the re-ask sees the same instructions.
 */
function buildRepairHook(model, toolNames, system) {
  return async ({ messages }) => {
    const last = messages.at(-1)
    if (!isAIMessage(last) || last.tool_calls?.length) return {}

    // The reducer replaces by id, so reusing it swaps this message rather than appending to it.
    const content = typeof last.content === 'string' ? last.content : ''
    const answer = { messages: [new AIMessage({ id: last.id, content: toPlainText(content) })] }
    if (!toolNames.some((name) => content.includes(name))) return answer

    const retry = await model.invoke([system, ...messages, new HumanMessage(REASK)])
    if (!retry.tool_calls?.length) return answer
    return { messages: [new AIMessage({ id: last.id, content: '', tool_calls: retry.tool_calls })] }
  }
}

/**
 * Compile the assistant's agent over an already-built tool set. Kept separate from tool loading so
 * the eval harness can drive the real agent with stub tools.
 * @param {import('@langchain/core/tools').StructuredToolInterface[]} tools
 * @param {object} options
 * @param {boolean} options.isOnline - Selects the prompt variant (an offline note is appended offline).
 */
export function compileGraph(tools, { isOnline }) {
  const system = new SystemMessage(isOnline ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\n${OFFLINE_NOTE}`)
  // Bound here so createReactAgent takes the tools as given rather than binding them again.
  const model = chatModel().bindTools(tools)
  return createReactAgent({
    llm: model,
    tools,
    prompt: system,
    postModelHook: buildRepairHook(model, tools.map((t) => t.name), system),
  })
}

/**
 * The assistant's graph, bound to a connection state: online tools read the backend MCP server,
 * offline ones the device. Tools are imported lazily so the server-only layer loads on demand.
 * @param {boolean} isOnline - Passed to the tools, which pick their own source from it.
 * @param {object[]} drafts - Collects any payment the model drafts for confirmation.
 * @param {object[]} charts - Collects any spending breakdown a tool produces for inline display.
 * @param {string} [owner] - The session's `sub`; pass it from a caller that already read the session,
 *   so the online tools do not decrypt the cookie a second time.
 */
export async function buildGraph(isOnline, drafts, charts, owner) {
  const { walletTools } = await import('./tools')
  const tools = await walletTools(isOnline, drafts, charts, owner)
  return compileGraph(tools, { isOnline })
}
