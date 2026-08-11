import { getSession } from '@/lib/auth/session'
import { pauseLocalSync, resumeLocalSync } from '@/lib/local/LocalStoreClient'

/**
 * Pauses/resumes the on-device ObjectBox Sync connection, so going offline severs a real sync link
 * rather than just rerouting reads. Body: `{ action: 'pause' | 'resume' }`.
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

  const { action } = body ?? {}
  if (action !== 'pause' && action !== 'resume') {
    return new Response('action must be "pause" or "resume"', { status: 400 })
  }

  const result = action === 'pause' ? await pauseLocalSync() : await resumeLocalSync()
  return Response.json(result)
}
