import 'server-only'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

let toolsPromise = null

/**
 * The backend's MCP tools as LangChain tools, keyed by name. Connects once and caches; a failed
 * connection clears the cache so the next turn retries instead of staying broken.
 * @returns {Promise<Map<string, import('@langchain/core/tools').StructuredToolInterface>>}
 */
export function getMcpTools() {
  if (!toolsPromise) {
    const client = new MultiServerMCPClient({
      prefixToolNameWithServerName: false,
      additionalToolNamePrefix: '',
      mcpServers: {
        'leafy-wallet': { transport: 'http', url: `${BACKEND_URL}/mcp/` },
      },
    })
    toolsPromise = client
      .getTools()
      .then((tools) => new Map(tools.map((t) => [t.name, t])))
      .catch((error) => {
        toolsPromise = null
        throw error
      })
  }
  return toolsPromise
}

/**
 * An MCP tool result as a plain array of rows. The adapter returns `structuredContent`, an array of
 * text blocks, or a bare string depending on the response, and each normalizes to an array.
 * @param {unknown} result
 * @returns {any[]}
 */
export function parseMcpResult(result) {
  const structured = result?.structuredContent?.result
  if (structured !== undefined) return Array.isArray(structured) ? structured : [structured]

  const blocks = Array.isArray(result) ? result : [result]
  const rows = blocks
    .map((block) => (typeof block === 'string' ? block : block?.text))
    .filter((text) => typeof text === 'string' && text.trim())
    .map((text) => JSON.parse(text))
  // A lone block can itself carry the whole array.
  if (rows.length === 1 && Array.isArray(rows[0])) return rows[0]
  return rows
}
