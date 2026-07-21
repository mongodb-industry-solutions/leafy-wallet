import 'server-only'

// Ollama on a developer machine, Voyage once deployed. Deployments run no Ollama container, and the
// two models have different vector widths, so each environment keeps its own Atlas database.
const APP_ENV = process.env.APP_ENV ?? 'local'

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text'

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-3-large'
const VOYAGE_KEY = process.env.VOYAGE_API_KEY ?? ''

/** Vector width of the active provider. Must match the ObjectBox HNSW index and the Atlas index. */
const EMBEDDING_DIMENSIONS = APP_ENV === 'local' ? 768 : 1024

async function embedWithOllama(inputs) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, input: inputs }),
  })
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`)
  const data = await res.json()
  return data.embeddings
}

async function embedWithVoyage(inputs) {
  if (!VOYAGE_KEY) {
    throw new Error(`APP_ENV is "${APP_ENV}" but VOYAGE_API_KEY is not set - nothing can embed.`)
  }
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: inputs,
      input_type: 'document',
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  })
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`)
  const data = await res.json()
  // Voyage wraps each vector in an object, Ollama returns them bare, so unwrap to match.
  return data.data.map((d) => d.embedding)
}

/**
 * Embed one or more strings with the environment's embedding model.
 * @param {string[]} inputs
 * @returns {Promise<number[][]>} One vector per input, in order.
 */
export const embed = (inputs) =>
  APP_ENV === 'local' ? embedWithOllama(inputs) : embedWithVoyage(inputs)
