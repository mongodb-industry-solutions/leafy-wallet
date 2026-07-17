import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { getSession } from '@/lib/auth/session'
import { buildGraph } from '@/lib/ai/graph'

// The model runs on CPU here, so a long tool-calling turn can take minutes.
export const maxDuration = 300

const toLangChain = (m) => (m.role === 'assistant' ? new AIMessage(m.text) : new HumanMessage(m.text))

/**
 * Runs one assistant turn, streaming NDJSON: `{type:"token"|"draft"|"error", ...}` per line.
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

  const { message, history = [], isOnline = true } = body
  if (!message?.trim()) return new Response('A message is required', { status: 400 })

  const drafts = []
  const charts = []
  const graph = buildGraph(isOnline, drafts, charts)
  const messages = [...history.map(toLangChain), new HumanMessage(message)]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
      // Drafts and charts go out the moment a tool creates them, so the cards land with the
      // reply rather than trailing the finished stream.
      let sentDrafts = 0
      let sentCharts = 0
      const flushCards = () => {
        for (; sentDrafts < drafts.length; sentDrafts++) send({ type: 'draft', draft: drafts[sentDrafts] })
        for (; sentCharts < charts.length; sentCharts++) send({ type: 'chart', chart: charts[sentCharts] })
      }
      try {
        // `messages` mode yields every message chunk, including tool results - only the
        // model's own tokens (`ai` chunks) are for the user.
        for await (const [chunk] of await graph.stream({ messages }, { streamMode: 'messages' })) {
          flushCards()
          if (chunk?.getType?.() !== 'ai') continue
          const text = typeof chunk.content === 'string' ? chunk.content : ''
          if (text) send({ type: 'token', text })
        }
        flushCards()
      } catch (error) {
        send({ type: 'error', text: error.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
