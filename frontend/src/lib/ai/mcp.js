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
 * An MCP tool result as parsed JSON. Adapters return either the text content directly or an
 * array of content blocks, depending on the response shape.
 * @param {unknown} result
 * @returns {any}
 */
export function parseMcpResult(result) {
  if (typeof result === 'string') return JSON.parse(result)
  if (Array.isArray(result)) {
    const text = result
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('')
    return JSON.parse(text)
  }
  return result
}
