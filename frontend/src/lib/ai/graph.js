import { ChatOllama } from '@langchain/ollama'
import { ChatAnthropic } from '@langchain/anthropic'
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { SystemMessage, AIMessage } from '@langchain/core/messages'
import { SYSTEM_PROMPT, OFFLINE_NOTE } from './prompt'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
// 7b over 3b: a weaker tool-caller narrates its intent instead of emitting the call, which shows up
// as spending questions that never draw their chart. The extra latency buys reliable routing.
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b'

// The model sizes context from VRAM, and the container reports none - without this it defaults to
// 4096, which the system prompt and a couple of tool results exhaust.
const NUM_CTX = 8192
// Fixed seed so a turn is as reproducible as the runtime allows.
const SEED = 42

// "local" on a developer machine, "staging"/"prod" once deployed (see environment/*.yaml). Not
// NODE_ENV: Next pins that to `production` in any built image, including the local Docker one.
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
      // qwen3 reasons in a <think> block by default, which adds latency and can leak into the reply;
      // turn it off so it answers directly. Non-thinking models (qwen2.5) ignore this.
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

/**
 * Pull JSON objects out of a string by scanning for balanced top-level braces. Used to recover a
 * tool call the model wrote into its message text instead of emitting as a structured call.
 */
function extractJsonObjects(text) {
  const objects = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    let depth = 0
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) {
        try {
          objects.push({ value: JSON.parse(text.slice(i, j + 1)), start: i })
        } catch {
          /* not valid JSON; skip */
        }
        i = j
        break
      }
    }
  }
  return objects
}

/** Parse a `key="value", n=50, flag=true` argument list (the kwargs form of a narrated call). */
function parseKwargs(argString) {
  const args = {}
  const re = /([a-z_][a-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false)/gi
  let match
  while ((match = re.exec(argString))) {
    const [, key, raw] = match
    if (raw[0] === '"' || raw[0] === "'") args[key] = raw.slice(1, -1)
    else if (raw === 'true' || raw === 'false') args[key] = raw === 'true'
    else args[key] = Number(raw)
  }
  return args
}

/**
 * Local models (qwen2.5 here) sometimes write a tool call into their message content instead of
 * emitting it as a structured call, and Ollama passes that text straight through. Recover the shapes
 * it uses - a `{"name":..,"arguments":..}` object (optionally in `<tool_call>` tags), a bare args
 * object after the tool's name, or a `name(key="value", ..)` call - so the turn still reaches the tool.
 * @returns {{name: string, args: object, id: string, type: 'tool_call'}[]}
 */
export function recoverToolCalls(content, toolNames) {
  if (typeof content !== 'string') return []
  const calls = []
  const seen = new Set()
  const add = (name, args) => {
    if (!toolNames.includes(name)) return
    const key = `${name}:${JSON.stringify(args)}`
    if (seen.has(key)) return
    seen.add(key)
    calls.push({ name, args, id: `rec_${calls.length}`, type: 'tool_call' })
  }

  // JSON forms: {"name":..,"arguments":..} or a bare args object after the tool's name.
  for (const { value, start } of extractJsonObjects(content)) {
    if (typeof value.name === 'string') {
      add(value.name, value.arguments ?? value.parameters ?? {})
    } else {
      const preceding = content.slice(0, start).match(/([a-z_][a-z0-9_]*)\s*\(?\s*$/i)
      if (preceding) add(preceding[1], value)
    }
  }

  // Kwargs form: draft_payment(contact_name="Luis", amount=50, mode="send", note="team dinner").
  const callRe = /([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi
  let call
  while ((call = callRe.exec(content))) add(call[1], parseKwargs(call[2]))

  // Natural-language form: draft_payment called with contact_name 'Luis', amount 50, note 'x'.
  const nlRe = /([a-z_][a-z0-9_]*)\s+(?:called\s+)?with\s+([^.]+)/gi
  let nl
  const pairRe = /([a-z_][a-z0-9_]*)\s+(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?))/gi
  while ((nl = nlRe.exec(content))) {
    if (!toolNames.includes(nl[1])) continue
    const args = {}
    let pair
    while ((pair = pairRe.exec(nl[2]))) {
      const [, key, single, double, num] = pair
      args[key] = num !== undefined ? Number(num) : (single ?? double)
    }
    if (Object.keys(args).length) add(nl[1], args)
  }

  return calls
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

/**
 * Compile the assistant's graph over an already-built tool set: the model either answers or calls a
 * tool, looping until it answers. Kept separate from tool loading so the eval harness can drive the
 * real graph with stub tools.
 * @param {import('@langchain/core/tools').StructuredToolInterface[]} tools
 * @param {object} options
 * @param {boolean} options.isOnline - Selects the prompt variant (an offline note is appended offline).
 */
export function compileGraph(tools, { isOnline }) {
  const toolNames = tools.map((t) => t.name)
  const model = chatModel().bindTools(tools)

  async function callModel(state) {
    const system = new SystemMessage(isOnline ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\n${OFFLINE_NOTE}`)
    const messages = [system, ...state.messages]
    let reply
    try {
      reply = await model.invoke(messages)
    } catch (e) {
      // A local model call can drop mid-flight; the Anthropic SDK already retries its own transport.
      if (APP_ENV !== 'local') throw e
      reply = await model.invoke(messages)
    }
    // Salvage a tool call written as prose, which is how the local model often emits one.
    if (!reply.tool_calls?.length) {
      const recovered = recoverToolCalls(reply.content, toolNames)
      if (recovered.length) return { messages: [new AIMessage({ content: '', tool_calls: recovered })] }
      // No tool follows, so this is the answer the user reads.
      if (typeof reply.content === 'string') reply.content = toPlainText(reply.content)
    }
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

/**
 * The assistant's graph, bound to a connection state. Loads the tool set (online: the backend MCP
 * server; offline: the on-device store) and compiles the graph over it. Async, and the tools are
 * imported lazily, so the server-only data layer never loads until a real turn runs.
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
