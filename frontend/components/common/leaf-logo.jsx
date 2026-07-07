'use client'

import { MongoDBLogoMark } from '@leafygreen-ui/logo'

// colors ('green-dark-2' default, 'white', 'black', 'green-base').
export function LeafLogo({ size = 32, color }) {
  return <MongoDBLogoMark height={size} color={color} aria-label="Leafy Wallet" />
}
