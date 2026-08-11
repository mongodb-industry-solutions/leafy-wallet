'use client'

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

/** One blurred, masked ring layer stack for {@link ConnectionGlow}. */
function GlowFrame({ background, opacity }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-2 z-0 overflow-hidden transition-opacity duration-1000 ease-in-out"
      style={{ borderRadius: RADIUS, opacity, mixBlendMode: 'multiply' }}
    >
      {LAYERS.map(({ band, blur }) => (
        <div key={band} className="absolute inset-0" style={{ filter: `blur(${blur}px) saturate(1.5)` }}>
          <div className="absolute inset-0" style={{ borderRadius: RADIUS, padding: band, ...MASK }}>
            <div className="absolute inset-0" style={{ background }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Edge-of-screen glow that ambiently signals online/offline around the whole presenter stage. The two
 * states differ by chroma rather than lightness, so they stay tellable apart at a glance.
 * @param {object} props
 * @param {boolean} props.isOnline - Whether the simulated connection is up.
 */
export function ConnectionGlow({ isOnline }) {
  return (
    <>
      {/* Sits the stage a touch below the lit rim, so the border reads as the brightest edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-2 z-0"
        style={{
          borderRadius: RADIUS,
          mixBlendMode: 'multiply',
          background: 'radial-gradient(115% 90% at 50% 50%, var(--muted) 20%, transparent 80%)',
        }}
      />
      <GlowFrame background="var(--primary)" opacity={isOnline ? 1 : 0} />
      <GlowFrame background="var(--muted-foreground)" opacity={isOnline ? 0 : 0.4} />
    </>
  )
}
