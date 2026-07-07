'use client'

const ONLINE = '#00FF6E, #00F55E, #00F0D2, #00B4FF, #3D7BFF, #00F0D2, #00FF6E'
const OFFLINE = '#2B353C, #1C242A, #333F46, #232D33, #1C242A, #2B353C, #2B353C'
const RADIUS = 22

const LAYERS = [
  { band: 4, blur: 6 },
  { band: 8, blur: 20 },
  { band: 13, blur: 38 },
]

const MASK = {
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  maskComposite: 'exclude',
}

function GlowFrame({ colors, opacity, animate }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-2 z-0 overflow-hidden transition-opacity duration-1000 ease-in-out"
      style={{ borderRadius: RADIUS, opacity, mixBlendMode: 'multiply' }}
    >
      {LAYERS.map(({ band, blur }, i) => (
        <div key={i} className="absolute inset-0" style={{ filter: `blur(${blur}px) saturate(3)` }}>
          <div className="absolute inset-0" style={{ borderRadius: RADIUS, padding: band, ...MASK }}>
            <div
              className="absolute inset-[-50%]"
              style={{
                background: `conic-gradient(from 210deg, ${colors})`,
                ...(animate && { animation: 'glow-spin 20s linear infinite' }),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConnectionGlow({ online }) {
  return (
    <>
      <GlowFrame colors={ONLINE} opacity={online ? 1 : 0} animate />
      <GlowFrame colors={OFFLINE} opacity={online ? 0 : 0.6} />
    </>
  )
}
