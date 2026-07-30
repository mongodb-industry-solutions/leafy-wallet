'use client'

import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { useCibaLogin } from '@/components/stage/FaceIdEntry/useCibaLogin'
import { cn } from '@/lib/utils'

const FACE_ID_LOTTIE = 'face-id.lottie'

/**
 * Face-ID-style unlock shown on return visits when a passwordless credential exists. The scan animates
 * while useCibaLogin runs the login in the background and drives the exit transition.
 * @param {object} props
 * @param {() => void} props.onAuthed - Session established.
 * @param {() => void} props.onFallback - Fall back to the full SSO login.
 */
export function FaceIdEntry({ onAuthed, onFallback }) {
  const { isExiting } = useCibaLogin(onAuthed, onFallback)

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 grid place-items-center bg-foreground/35 px-6 backdrop-blur-xl transition-opacity duration-500',
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

        <div className="relative mx-auto grid size-52 place-items-center">
          <DotLottieReact src={FACE_ID_LOTTIE} autoplay loop className="size-48" />
        </div>
      </div>
    </div>
  )
}
