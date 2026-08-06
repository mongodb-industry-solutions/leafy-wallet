import 'server-only'

const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL ?? 'http://localhost:8091'
const EMBEDDING_MODEL = process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-4-large'
const VOYAGE_KEY = process.env.VOYAGE_API_KEY ?? ''
const EMBEDDING_DIMENSIONS = 1024

/**
 * Embed one or more strings with the environment's embedding model.
 * @param {string[]} inputs
 * @param {'document'|'query'} [inputType] Voyage embeds queries and stored text asymmetrically.
 * @returns {Promise<number[][]>} One vector per input, in order.
 */
export async function embed(inputs, inputType = 'document') {
  const headers = { 'Content-Type': 'application/json' }
  if (VOYAGE_KEY) headers.Authorization = `Bearer ${VOYAGE_KEY}`

  const res = await fetch(`${EMBEDDINGS_URL}/v1/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  })
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`)
  const data = await res.json()
  return data.data.map((d) => d.embedding)
}
