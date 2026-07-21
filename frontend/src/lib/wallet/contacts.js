/**
 * Which kind of Leafy Pay lookup an entered value is. Only an email carries an "@", so a typo'd
 * address falls through to a phone lookup and misses - the same neutral answer either way.
 * @param {string} value
 * @returns {'email'|'phone'}
 */
export function detectLookupType(value) {
  return String(value ?? '').includes('@') ? 'email' : 'phone'
}
