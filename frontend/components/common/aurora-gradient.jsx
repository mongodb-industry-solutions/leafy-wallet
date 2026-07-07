'use client'

import { useEffect, useId, useState } from 'react'

/* ==========================================================================
 * Aurora gradient — a soft rainbow glow anchored to the bottom that RISES UP on
 * mount via a scaleY(0) → 1 transform, so it unfurls from the floor like an
 * aurora. A row of tall, heavily-blurred rainbow columns in a bell curve. Zero
 * dependencies, no canvas, no per-frame work.
 * ======================================================================== */

const VBW = 1271
const VBH = 599

// Stops, bottom (0) → top (1): dark ember → blue → near-white → yellow →
// red-orange → magenta → transparent pink.
const AURORA_STOPS = [
  { offset: 0, color: '#340B05' },
  { offset: 0.1827, color: '#0358F7' },
  { offset: 0.2837, color: '#5092C7' },
  { offset: 0.4135, color: '#E1ECFE' },
  { offset: 0.5866, color: '#FFD400' },
  { offset: 0.6827, color: '#FA3D1D' },
  { offset: 0.8029, color: '#FD02F5' },
  { offset: 1, color: '#FFC0FD00' },
]

// Height curve: a gentle power falloff giving the flatter, pyramid-like rise.
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

export function AuroraGradient({
  bars = 9,
  blur = 15,
  peak = 0.98,
  valley = 0.55,
  stops = AURORA_STOPS,
  riseMs = 1100,
}) {
  const uid = useId()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  const heights = bellHeights(bars, peak, valley)
  const colW = VBW / bars
  const gradId = `aurora-grad-${uid}`
  const blurId = `aurora-blur-${uid}`

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
