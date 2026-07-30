'use client'

import { MongoDBLogoMark } from '@leafygreen-ui/logo'

/**
 * The Leafy Wallet wordmark (MongoDB's leaf logo mark).
 * @param {object} props
 * @param {number} [props.size] - Logo height in pixels.
 * @param {string} [props.color] - 'green-dark-2' (default), 'white', 'black', or 'green-base'.
 */
export function LeafLogo({ size = 32, color }) {
  return <MongoDBLogoMark height={size} color={color} aria-label="Leafy Wallet" />
}
