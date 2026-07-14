'use client'

import { useEffect, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { getMeta, sign, loginHintToken, deleteCredential } from '@/lib/auth/authenticator'
import { cibaStart, cibaChallenge, cibaApprove, cibaPoll } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

const FACE_ID_LOTTIE = 'face-id.lottie'

// Keep the scan visible for at least this long so a fast CIBA round-trip doesn't flash.
const MIN_VISIBLE_MS = 1400

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Face-ID-style unlock shown on return visits when a passwordless credential exists. Runs the CIBA
 * login in the background while the scan animates: start → challenge → sign locally → approve → poll.
 * On success hands off to `onAuthed`; if the credential is gone/denied it clears it and calls `onFallback`.
 * @param {object} props
 * @param {() => void} props.onAuthed - Session established.
 * @param {() => void} props.onFallback - Fall back to the full SSO login.
 */
export function FaceIdEntry({ onAuthed, onFallback }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()

    const succeed = async () => {
      const remaining = MIN_VISIBLE_MS - (Date.now() - startedAt)
      if (remaining > 0) await sleep(remaining)
      if (cancelled) return
      setIsExiting(true)
      await sleep(500)
      if (!cancelled) onAuthed?.()
    }

    const fallback = async ({ revoked } = {}) => {
      if (revoked) await deleteCredential().catch(() => {})
      if (!cancelled) onFallback?.()
    }

    async function run() {
      try {
        const meta = await getMeta()
        if (!meta) return fallback()

        const start = await cibaStart({ login_hint_token: loginHintToken(meta.sub) })
        if (!start.ok) return fallback()
        const authReqId = start.auth_req_id

        const ch = await cibaChallenge(authReqId)
        if (!ch.ok) return fallback()

        const { credentialId, signature } = await sign(ch.challenge)
        const approve = await cibaApprove({ auth_req_id: authReqId, credentialId, signature })
        if (!approve.ok) {
          // 401/400 → the credential was revoked at Leafy Pay; clear it and fall back.
          return fallback({ revoked: approve.status === 401 || approve.status === 400 })
        }

        const interval = Math.max(Number(start.interval) || 5, 2) * 1000
        const deadline = Date.now() + Math.max(Number(start.expires_in) || 300, 60) * 1000
        while (!cancelled) {
          await sleep(interval)
          const p = await cibaPoll({ auth_req_id: authReqId })
          if (p.status === 'done') return succeed()
          if (p.status === 'pending' || p.status === 'slow_down') {
            if (Date.now() > deadline) return fallback()
            continue
          }
          return fallback() // denied / expired / error
        }
      } catch {
        if (!cancelled) fallback()
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [onAuthed, onFallback])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 grid place-items-center bg-[rgba(0,20,28,0.34)] px-6 backdrop-blur-xl transition-opacity duration-500',
        isExiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div
        className={cn(
          'relative w-[360px] max-w-full overflow-hidden rounded-[32px] border border-white/50 bg-white/70 px-8 pt-12 pb-10 text-center shadow-[0_50px_120px_-28px_rgba(0,30,43,0.5)] backdrop-blur-2xl transition-transform duration-500',
          isExiting ? 'scale-95' : 'scale-100',
        )}
      >
        {/* Glossy top sheen. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/70 to-transparent"
        />

        <div className="relative flex flex-col items-center">
          <div className="grid size-52 place-items-center">
            <DotLottieReact src={FACE_ID_LOTTIE} autoplay loop className="size-48" />
          </div>
        </div>
      </div>
    </div>
  )
}
