import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { getSession } from '@/lib/auth/session'
import { buildGraph } from '@/lib/ai/graph'

// Inert on this self-hosted deployment; the real ceiling is the ingress read timeout.
export const maxDuration = 300

const toLangChain = (m) => (m.role === 'assistant' ? new AIMessage(m.text) : new HumanMessage(m.text))

/**
 * Runs one assistant turn and returns the whole result: `{ reply, drafts, charts }`. We wait for the
 * full turn rather than streaming tokens - on a slow local model the token trickle stutters the
 * client typewriter, so the browser reveals the finished reply at a steady rate instead.
 *
 * Body: `{ message: string, history?: {role, text}[], isOnline?: boolean }`. The graph lives here
 * rather than the browser because the tools read the session and call Leafy Pay server-side.
 */
export async function POST(request) {
  const session = await getSession()
  if (!session?.sub) return new Response('Unauthorized', { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  // `?? {}` because a body of literal `null` parses fine and would throw on destructure.
  const { message, history = [], isOnline = true } = body ?? {}
  if (!message?.trim()) return new Response('A message is required', { status: 400 })

  const drafts = []
  const charts = []
  const graph = await buildGraph(isOnline, drafts, charts, session.sub)
  const messages = [...history.map(toLangChain), new HumanMessage(message)]

  try {
    const result = await graph.invoke({ messages })
    const last = result.messages.at(-1)
    const reply = typeof last?.content === 'string' ? last.content : ''
    // The tools pushed any drafts/charts into these arrays while the graph ran.
    return Response.json({ reply, drafts, charts }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Keep transport details (upstream URLs, driver errors) out of the chat bubble.
    console.error('[chat] turn failed', error)
    return Response.json({ error: 'The assistant could not complete that turn.' }, { status: 500 })
  }
}
