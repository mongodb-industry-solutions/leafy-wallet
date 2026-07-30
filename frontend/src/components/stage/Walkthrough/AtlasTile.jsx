'use client'

import { LeafLogo } from '@/components/common/LeafLogo/LeafLogo'

const LOGO_PX = 24

/** Atlas endpoint tile shared by the sync mini-renders: the leaf mark on a tinted square. */
export function AtlasTile() {
  return (
    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
      <LeafLogo size={LOGO_PX} />
    </span>
  )
}
