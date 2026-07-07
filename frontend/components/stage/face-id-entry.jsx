'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { TextReveal } from '@/components/ui/text-reveal'
import { cn } from '@/lib/utils'

const FACE_ID_LOTTIE =
  'https://lottie.host/9e4ee80f-96cb-4267-82b0-e04a55850201/GyxjE6SLeg.lottie'

const SWEEP_COLORS = ['#00684A', '#00A35C', '#00ED64', '#71F6BA', '#016BF8']

/**
 * Still WIP, but the idea is that this will be shown when authing to Leafy Pay system.
 */
export function FaceIdEntry({ user, onAuthed }) {
  const [phase, setPhase] = useState('scanning') // 'scanning' | 'welcome'
  const [exiting, setExiting] = useState(false)
  const [dotLottie, setDotLottie] = useState(null)

  useEffect(() => {
    if (phase !== 'scanning') return
    const fallback = setTimeout(() => setPhase('welcome'), 6000)
    if (!dotLottie) return () => clearTimeout(fallback)
    const onComplete = () => setPhase('welcome')
    dotLottie.addEventListener('complete', onComplete)
    return () => {
      clearTimeout(fallback)
      dotLottie.removeEventListener('complete', onComplete)
    }
  }, [phase, dotLottie])

  useEffect(() => {
    if (phase !== 'welcome') return
    const toExit = setTimeout(() => setExiting(true), 2200)
    const toDone = setTimeout(() => onAuthed(), 2700)
    return () => {
      clearTimeout(toExit)
      clearTimeout(toDone)
    }
  }, [phase, onAuthed])

  const skip = () => {
    if (phase === 'scanning') {
      setPhase('welcome')
    } else {
      setExiting(true)
      setTimeout(onAuthed, 400)
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 grid place-items-center bg-[rgba(0,20,28,0.34)] px-6 backdrop-blur-xl transition-opacity duration-500',
        exiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <button
        type="button"
        onClick={skip}
        aria-label="Unlock"
        className={cn(
          'relative w-[360px] max-w-full cursor-pointer overflow-hidden rounded-[32px] border border-white/50 bg-white/70 px-8 pt-12 pb-10 text-center shadow-[0_50px_120px_-28px_rgba(0,30,43,0.5)] backdrop-blur-2xl transition-transform duration-500',
          exiting ? 'scale-95' : 'scale-100',
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

          {/* On welcome, grow the card downward to make room for the greeting
              instead of snapping the layout. */}
          <AnimatePresence initial={false}>
            {phase === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{
                  height: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.4, delay: 0.12 },
                }}
                className="overflow-hidden"
              >
                <div className="pt-7">
                  <TextReveal
                    text={`Welcome back, ${user.name}!`}
                    colors={SWEEP_COLORS}
                    duration={1.1}
                    className="text-2xl font-bold tracking-tight"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>
    </div>
  )
}
