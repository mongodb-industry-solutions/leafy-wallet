/**
 * Contacts whose name or lookup hint contains `query`, case-insensitively. An empty or blank query
 * matches everything, so the caller can pass the raw search box value.
 * @param {object[]} contacts - Normalized contacts (`name`, `lookupHint`).
 * @param {string} query - Raw search text; trimmed and lowercased here.
 * @returns {object[]}
 */
export function filterContacts(contacts, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return contacts
  return contacts.filter(
    (c) => c.name.toLowerCase().includes(needle) || c.lookupHint.toLowerCase().includes(needle),
  )
}
