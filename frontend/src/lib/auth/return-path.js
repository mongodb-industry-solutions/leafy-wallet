/**
 * Sanitize a `?return=` path so an auth round-trip lands back where it started (`/` or `/mobile`).
 * Only same-origin absolute paths pass, so the parameter can never be used as an open redirect.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function safeReturnPath(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}
