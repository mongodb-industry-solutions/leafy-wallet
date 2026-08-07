/**
 * Sanitize a `?return=` path so an auth round-trip can land back on the route it started from
 * (`/` or `/mobile`). Only same-origin absolute paths are allowed - anything else falls back to `/`,
 * so the parameter can never be used as an open redirect.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function safeReturnPath(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}
