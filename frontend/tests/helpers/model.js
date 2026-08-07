export const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
export const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b'

const APP_ENV = process.env.APP_ENV ?? 'local'
const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL ?? 'http://localhost:8091'

/** Fail with the pull command rather than a timeout when Ollama is down or a model is missing. */
async function assertOllamaHas(model) {
  let tags
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    tags = await res.json()
  } catch {
    throw new Error(
      `\n\n  Ollama is not reachable at ${OLLAMA_URL}.\n` +
        `  Start it, then pull the model:\n` +
        `      ollama serve\n` +
        `      ollama pull ${model}\n`,
    )
  }
  const names = (tags.models ?? []).map((m) => m.name)
  if (!names.some((n) => n === model || n.startsWith(model))) {
    throw new Error(
      `\n\n  Ollama is running but "${model}" is not pulled.\n` +
        `      ollama pull ${model}\n` +
        `  Models present: ${names.join(', ') || '(none)'}\n`,
    )
  }
}

/**
 * Preflight for the category evals: the hosted Voyage API needs a key, the local leafy-embed
 * container needs to be up. Fail with the fix rather than a timeout.
 */
export async function assertEmbeddingsReady() {
  const isHosted = EMBEDDINGS_URL.includes('ai.mongodb.com')
  if (isHosted) {
    if (!process.env.VOYAGE_API_KEY) {
      throw new Error(
        `\n\n  EMBEDDINGS_URL points at the hosted Voyage API, but VOYAGE_API_KEY is unset.\n` +
          `  Set it, or point EMBEDDINGS_URL at a local leafy-embed instead.\n`,
      )
    }
    return
  }
  try {
    const res = await fetch(`${EMBEDDINGS_URL}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch {
    throw new Error(
      `\n\n  leafy-embed is not reachable at ${EMBEDDINGS_URL}.\n` +
        `  Start it:\n` +
        `      docker compose up -d --build leafy-embed\n`,
    )
  }
}

/**
 * Preflight for the AI evals: fail loudly when the model the graph would pick isn't reachable, so a
 * blocked commit says why instead of timing out.
 */
export async function assertModelReady() {
  if (APP_ENV !== 'local') {
    if (!process.env.GROVE_API_KEY) {
      throw new Error(
        `\n\n  APP_ENV is "${APP_ENV}" so the evals run against Grove, but GROVE_API_KEY is unset.\n` +
          `  Set it, or unset APP_ENV to evaluate the local model instead.\n`,
      )
    }
    return
  }
  await assertOllamaHas(CHAT_MODEL)
}
