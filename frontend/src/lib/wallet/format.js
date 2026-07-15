// Avatar background palette for contact/transaction Peeps, indexed by a stable hash of the reference.
const AVATAR_BGS = ['ede9fe', 'fce7f3', 'dcfce7', 'ffedd5', 'cffafe', 'dbeafe', 'fef3c7']

/**
 * Derives a stable Peep avatar (seed + background) from a key, so the same contact always looks the same.
 * @param {string} key - A stable identifier (beneficiary reference or label).
 * @returns {{seed: string, bg: string}}
 */
export function avatarFor(key) {
  const s = String(key ?? 'anon')
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return { seed: s, bg: AVATAR_BGS[hash % AVATAR_BGS.length] }
}

/**
 * Formats an ISO timestamp into a compact list label: "Today", "Yesterday", or "Mon D".
 * @param {string|null} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return 'Earlier'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Earlier'
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Formats a numeric amount with thousands separators and two decimals (e.g. 12458.3 → "12,458.30").
 * @param {number} value
 * @returns {string}
 */
export function formatMoney(value) {
  return Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
