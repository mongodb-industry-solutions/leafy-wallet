'use client'

import { useEffect, useRef, useState } from 'react'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react'

import { cn } from '@/lib/utils'

const DEFAULT_COLORS = ['#c679c4', '#fa3d1d', '#ffb005', '#e1e1fe', '#0358f7']
const BAND_HALF = 17
const SWEEP_START = -BAND_HALF
const SWEEP_END = 100 + BAND_HALF

const sweepEase = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

function buildGradient(pos, colors, textColor) {
  const bandStart = pos - BAND_HALF
  const bandEnd = pos + BAND_HALF

  if (bandStart >= 100) {
    return `linear-gradient(90deg, ${textColor}, ${textColor})`
  }
  const n = colors.length
  const parts = []

  if (bandStart > 0)
    parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`)

  colors.forEach((c, i) => {
    const pct = n === 1 ? pos : bandStart + (i / (n - 1)) * BAND_HALF * 2
    parts.push(`${c} ${pct.toFixed(2)}%`)
  })

  if (bandEnd < 100)
    parts.push(`transparent ${bandEnd.toFixed(2)}%`, `transparent 100%`)

  return `linear-gradient(90deg, ${parts.join(', ')})`
}

function measureWidths(el, texts) {
  const ghost = el.cloneNode()
  Object.assign(ghost.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: 'auto',
    whiteSpace: 'nowrap',
  })
  el.parentElement.appendChild(ghost)
  const widths = texts.map((t) => {
    ghost.textContent = t
    return ghost.getBoundingClientRect().width
  })
  ghost.remove()
  return widths
}

/**
 * Sweeping gradient text reveal.
 *
 * @param {object} props
 * @param {string|string[]} props.text - Text to reveal (array rotates when `repeat`).
 * @param {string[]} [props.colors] - Colors sampled across the moving band.
 * @param {string} [props.textColor] - Color of revealed text. Default `var(--foreground)`.
 * @param {number} [props.duration] - Seconds for one sweep. Default 1.5.
 * @param {number} [props.delay] - Seconds before the sweep starts. Default 0.
 * @param {boolean} [props.repeat] - Replay/advance through the array. Default false.
 * @param {number} [props.repeatDelay] - Seconds between cycles. Default 0.5.
 * @param {boolean} [props.startOnView] - Start only once in view. Default true.
 * @param {boolean} [props.once] - Fire in-view detection at most once. Default true.
 * @param {string} [props.className] - Extra classes for the span.
 * @param {boolean} [props.fixedWidth] - Use the widest string's width for layout. Default false.
 */
export function TextReveal({
  text,
  colors = DEFAULT_COLORS,
  textColor = 'var(--foreground)',
  duration = 1.5,
  delay = 0,
  repeat = false,
  repeatDelay = 0.5,
  startOnView = true,
  once = true,
  className,
  fixedWidth = false,
  ...props
}) {
  const texts = Array.isArray(text) ? text : [text]
  const isMulti = texts.length > 1
  const prefersReducedMotion = useReducedMotion()

  const spanRef = useRef(null)
  const optsRef = useRef({
    colors,
    textColor,
    duration,
    delay,
    repeat,
    repeatDelay,
    texts,
  })
  optsRef.current = {
    colors,
    textColor,
    duration,
    delay,
    repeat,
    repeatDelay,
    texts,
  }

  const indexRef = useRef(0)
  const hasPlayedRef = useRef(false)
  const timerRef = useRef(undefined)
  const playRef = useRef(null)
  const stopRef = useRef(null)

  const [activeIndex, setActiveIndex] = useState(0)
  const [measuredWidths, setMeasuredWidths] = useState([])

  const sweepPos = useMotionValue(SWEEP_START)

  const backgroundImage = useTransform(sweepPos, (pos) =>
    buildGradient(pos, optsRef.current.colors, optsRef.current.textColor),
  )

  const isInView = useInView(spanRef, { once, amount: 0.1 })

  useEffect(() => {
    const el = spanRef.current
    if (!el || !isMulti) return
    setMeasuredWidths(measureWidths(el, texts))
  }, [Array.isArray(text) ? text.join('\0') : text])

  playRef.current = () => {
    const { duration, delay, repeat, repeatDelay, texts } = optsRef.current

    sweepPos.set(SWEEP_START)

    const controls = animate(sweepPos, SWEEP_END, {
      duration,
      delay,
      ease: sweepEase,
      onComplete() {
        if (!repeat) return
        timerRef.current = setTimeout(() => {
          const next = (indexRef.current + 1) % texts.length
          indexRef.current = next
          setActiveIndex(next)
          playRef.current()
        }, repeatDelay * 1000)
      },
    })

    stopRef.current = () => controls.stop()
  }

  useEffect(() => {
    if (prefersReducedMotion) {
      sweepPos.set(SWEEP_END)
      return
    }
    if (startOnView && !isInView) return
    if (once && hasPlayedRef.current) return
    hasPlayedRef.current = true
    playRef.current()

    return () => {
      stopRef.current?.()
      clearTimeout(timerRef.current)
    }
  }, [isInView, startOnView, once, prefersReducedMotion, sweepPos])

  const fixedW =
    isMulti && fixedWidth && measuredWidths.length > 0
      ? Math.max(...measuredWidths)
      : undefined

  const animatedW =
    isMulti && !fixedWidth && measuredWidths[activeIndex] != null
      ? measuredWidths[activeIndex]
      : undefined

  return (
    <motion.span
      ref={spanRef}
      className={cn('align-bottom leading-[100%] text-inherit', className)}
      style={{
        transform: 'translateY(-2px)',
        color: 'transparent',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        backgroundSize: '100% 100%',
        backgroundImage,
        ...(isMulti && {
          display: 'inline-block',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          verticalAlign: 'text-center',
          ...(fixedW != null && { width: fixedW }),
        }),
      }}
      animate={animatedW != null ? { width: animatedW } : undefined}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      {...props}
    >
      {texts[activeIndex]}
    </motion.span>
  )
}
