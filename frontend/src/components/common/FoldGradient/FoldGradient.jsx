'use client'

import { useEffect, useId, useState } from 'react'

const VBW = 1271
const VBH = 599

// Aurora palette, captured verbatim from the source playground: near-black →
// deep green → mint → teal → transparent.
const AURORA_STOPS = [
  { offset: 0, color: '#176645' },
  { offset: 0.0833, color: '#1C7550' },
  { offset: 0.1667, color: '#22855B' },
  { offset: 0.25, color: '#289566' },
  { offset: 0.3333, color: '#2EA571' },
  { offset: 0.4167, color: '#39C486' },
  { offset: 0.5, color: '#67D99E' },
  { offset: 0.5833, color: '#8DEAB5' },
  { offset: 0.6667, color: '#9AF0C9' },
  { offset: 0.75, color: '#80E0DA' },
  { offset: 0.8333, color: '#70D6E8EC' },
  { offset: 0.9167, color: '#A8E7ED76' },
  { offset: 1, color: '#D1F8F300' },
]

function bellHeights(n, peak, valley) {
  const out = []
  const mid = (n - 1) / 2
  for (let i = 0; i < n; i++) {
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid
    const eased = 1 - Math.pow(t, 1.24)
    out.push(peak * VBH * (valley + (1 - valley) * eased))
  }
  return out
}

/**
 * Blurred aurora columns in a bell curve, anchored to the bottom and rising on mount.
 * @param {object} props
 * @param {number} [props.bars] - Number of blurred columns.
 * @param {number} [props.blur] - Gaussian blur stdDeviation.
 * @param {number} [props.peak] - Tallest column as a fraction of the viewbox.
 * @param {number} [props.valley] - Shortest column relative to the peak.
 * @param {{offset: number, color: string}[]} [props.stops] - Bottom→top color stops.
 * @param {number} [props.riseMs] - Mount rise duration in ms.
 */
export function DiaGradient({ bars = 9, blur = 15, peak = 0.98, valley = 0.55, stops = AURORA_STOPS, riseMs = 1100 }) {
  const uid = useId().replace(/:/g, '')
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  const heights = bellHeights(bars, peak, valley)
  const colW = VBW / bars
  const gradId = `dia-grad-${uid}`
  const blurId = `dia-blur-${uid}`

  return (
    <div
      aria-hidden
      style={{
        height: '100%',
        width: '100%',
        transformOrigin: 'bottom',
        transform: shown ? 'scaleY(1)' : 'scaleY(0)',
        transition: `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange: 'transform',
      }}
    >
      <svg
        style={{ height: '100%', width: '100%' }}
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        {heights.map((h, i) => (
          <g key={i} filter={`url(#${blurId})`}>
            <rect x={i * colW} y={VBH - h} width={colW * 1.23} height={h} fill={`url(#${gradId})`} />
          </g>
        ))}
      </svg>
    </div>
  )
}

/**
 * The DiaGradient bar field laid onto a 3D plane folded away from the viewer.
 * @param {object} props
 * @param {number} [props.fold] - Dihedral fold angle in degrees (rotateX of the plane).
 * @param {number} [props.depth] - CSS perspective distance in px.
 * @param {number} [props.softness] - Extra CSS blur (px) melting the bars on the tilted plane.
 * @param {import('react').ReactNode} [props.children] - Custom plane content.
 * Any remaining props are forwarded to the default DiaGradient (bars, blur, peak, valley, stops, riseMs).
 */
export function FoldGradient({ fold = 74, depth = 620, softness = 8, children, className, style, ...barProps }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{ position: 'relative', overflow: 'hidden', height: '100%', width: '100%', ...style }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '175%',
          // perspective as a transform function so the vanishing point sits at
          // the plane's own top edge, tipping the bar field back like a floor.
          transform: `perspective(${depth}px) rotateX(${fold}deg)`,
          transformOrigin: '50% 0%',
          willChange: 'transform',
        }}
      >
        {/* blur lives INSIDE the tilted plane (on the content). A filter on the
            plane itself would flatten the 3D transform in some engines */}
        <div style={{ height: '100%', width: '100%', filter: softness > 0 ? `blur(${softness}px)` : undefined }}>
          {children ?? <DiaGradient {...barProps} />}
        </div>
      </div>
    </div>
  )
}
