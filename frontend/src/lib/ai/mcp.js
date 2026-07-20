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
 * An MCP tool result as a plain array of rows. FastMCP returns a list as one content block per
 * element (an empty list is an empty array), and the adapter may hand back a bare string for a
 * single block, so every shape normalizes to "array of parsed rows".
 * @param {unknown} result
 * @returns {any[]}
 */
export function parseMcpResult(result) {
  if (typeof result === 'string') {
    if (!result.trim()) return []
    const parsed = JSON.parse(result)
    return Array.isArray(parsed) ? parsed : [parsed]
  }
  if (Array.isArray(result)) {
    const rows = result
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => JSON.parse(block.text))
    if (rows.length === 1 && Array.isArray(rows[0])) return rows[0]
    return rows
  }
  return result
}
