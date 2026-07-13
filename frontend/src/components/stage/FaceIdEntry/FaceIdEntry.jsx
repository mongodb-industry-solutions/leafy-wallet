'use client'

import { useEffect, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { cn } from '@/lib/utils'

const FACE_ID_LOTTIE =
  'face-id.lottie'

// Fallback in case the Lottie never fires its `complete` event.
const SCAN_FALLBACK_MS = 6000

/**
 * Face-ID-style unlock screen shown before the wallet app: a scanning
 * animation that hands off to `onAuthed` once it finishes (tap to skip ahead).
 * @param {object} props
 * @param {() => void} props.onAuthed - Called once the unlock sequence finishes.
 */
export function FaceIdEntry({ onAuthed }) {
  const [isExiting, setIsExiting] = useState(false)
  const [dotLottie, setDotLottie] = useState(null)

  const finish = () => setIsExiting(true)

  useEffect(() => {
    const fallback = setTimeout(finish, SCAN_FALLBACK_MS)
    if (!dotLottie) return () => clearTimeout(fallback)
    dotLottie.addEventListener('complete', finish)
    return () => {
      clearTimeout(fallback)
      dotLottie.removeEventListener('complete', finish)
    }
  }, [dotLottie])

  useEffect(() => {
    if (!isExiting) return
    const toDone = setTimeout(onAuthed, 500)
    return () => clearTimeout(toDone)
  }, [isExiting, onAuthed])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 grid place-items-center bg-[rgba(0,20,28,0.34)] px-6 backdrop-blur-xl transition-opacity duration-500',
        isExiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <button
        type="button"
        onClick={finish}
        aria-label="Unlock"
        className={cn(
          'relative w-[360px] max-w-full cursor-pointer overflow-hidden rounded-[32px] border border-white/50 bg-white/70 px-8 pt-12 pb-10 text-center shadow-[0_50px_120px_-28px_rgba(0,30,43,0.5)] backdrop-blur-2xl transition-transform duration-500',
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
            <DotLottieReact
              src={FACE_ID_LOTTIE}
              autoplay
              dotLottieRefCallback={setDotLottie}
              className="size-48"
            />
          </div>
        </div>
      </button>
    </div>
  )
}
