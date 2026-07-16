import 'server-only'
import { createHmac } from 'crypto'
import { ENV } from '@/lib/auth/env'

/**
 * Blind index of an email: a keyed HMAC both the requester and the target can derive, so a payment
 * request can be addressed without either side storing the address.
 * @param {string} email
 * @returns {string} Hex digest, or '' if there's no email to digest.
 */
export function lookupDigest(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized) return ''
  const key = ENV.lookupDigestKey()
  // Without a key the digests would silently match nothing, stranding every request.
  if (!key) throw new Error('LOOKUP_DIGEST_KEY is not set — payment requests cannot be addressed')
  return createHmac('sha256', key).update(normalized).digest('hex')
}
