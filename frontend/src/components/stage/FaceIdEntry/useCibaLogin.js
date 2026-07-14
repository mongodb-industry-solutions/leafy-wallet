'use client'

import { useEffect, useState } from 'react'
import { getMeta, sign, loginHintToken, deleteCredential } from '@/lib/auth/authenticator'
import { cibaStart, cibaChallenge, cibaApprove, cibaPoll } from '@/lib/auth/actions'

// Keep the scan visible for at least this long so a fast CIBA round trip does not flash.
const MIN_VISIBLE_MS = 1400
const EXIT_MS = 500
const DEFAULT_INTERVAL_S = 5
const MIN_INTERVAL_S = 2
const DEFAULT_EXPIRY_S = 300
const MIN_EXPIRY_S = 60

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs the passwordless CIBA login in the background: start, challenge, sign locally, approve, poll.
 * Calls onAuthed once the session is set, or onFallback (clearing a revoked credential) on any failure.
 * @param {() => void} onAuthed - Session established.
 * @param {() => void} onFallback - Fall back to the full SSO login.
 * @returns {{isExiting: boolean}} Whether the exit transition has begun.
 */
export function useCibaLogin(onAuthed, onFallback) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()

    async function succeed() {
      const remaining = MIN_VISIBLE_MS - (Date.now() - startedAt)
      if (remaining > 0) await sleep(remaining)
      if (cancelled) return
      setIsExiting(true)
      await sleep(EXIT_MS)
      if (!cancelled) onAuthed?.()
    }

    async function fallback({ revoked } = {}) {
      if (revoked) await deleteCredential().catch(() => {})
      if (!cancelled) onFallback?.()
    }

    async function poll(start) {
      const interval = Math.max(Number(start.interval) || DEFAULT_INTERVAL_S, MIN_INTERVAL_S) * 1000
      const deadline = Date.now() + Math.max(Number(start.expires_in) || DEFAULT_EXPIRY_S, MIN_EXPIRY_S) * 1000
      while (!cancelled) {
        await sleep(interval)
        const result = await cibaPoll({ auth_req_id: start.auth_req_id })
        if (result.status === 'done') return succeed()
        if (result.status === 'pending' || result.status === 'slow_down') {
          if (Date.now() > deadline) return fallback()
          continue
        }
        return fallback() // denied, expired, or error
      }
    }

    async function run() {
      try {
        const meta = await getMeta()
        if (!meta) return fallback()

        const start = await cibaStart({ login_hint_token: loginHintToken(meta.sub) })
        if (!start.ok) return fallback()

        const challenge = await cibaChallenge(start.auth_req_id)
        if (!challenge.ok) return fallback()

        const { credentialId, signature } = await sign(challenge.challenge)
        const approval = await cibaApprove({ auth_req_id: start.auth_req_id, credentialId, signature })
        if (!approval.ok) {
          // 401 or 400 means the credential was revoked at Leafy Pay, so clear it and fall back.
          return fallback({ revoked: approval.status === 401 || approval.status === 400 })
        }

        await poll(start)
      } catch {
        if (!cancelled) fallback()
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [onAuthed, onFallback])

  return { isExiting }
}
