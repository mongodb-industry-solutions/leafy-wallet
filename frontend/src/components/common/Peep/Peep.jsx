'use client'

import { useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import * as openPeeps from '@dicebear/open-peeps'

/**
 * A deterministic avatar (dicebear "open-peeps") for a user or contact.
 * @param {object} props
 * @param {string} props.seed - Deterministic seed; same seed always draws the same avatar.
 * @param {string} props.bg - Background color (hex, no `#`).
 * @param {number} [props.size] - Avatar width/height in pixels.
 */
export function Peep({ seed, bg, size = 48 }) {
  const src = useMemo(() => {
    const svg = createAvatar(openPeeps, {
      seed,
      size,
      backgroundColor: [bg],
      backgroundType: ['solid'],
    }).toString()
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }, [seed, bg, size])

  return <img className="block rounded-full" src={src} width={size} height={size} alt="" />
}
