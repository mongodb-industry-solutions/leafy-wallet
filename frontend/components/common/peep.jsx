'use client'

import { useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import * as openPeeps from '@dicebear/open-peeps'

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
