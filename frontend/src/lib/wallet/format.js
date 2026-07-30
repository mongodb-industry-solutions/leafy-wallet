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

/** Sort comparator for rows carrying `createdAt`: newest first. */
export const byNewestFirst = (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)

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

/**
 * Groups a date-sorted transaction list into consecutive runs sharing the same `date` label, so a list
 * can render a header before each run. Input is assumed newest-first, so same-date items are adjacent.
 * @param {object[]} transactions
 * @returns {{date: string, items: object[]}[]}
 */
export function groupByDate(transactions) {
  const groups = []
  for (const tx of transactions) {
    const last = groups[groups.length - 1]
    if (last && last.date === tx.date) {
      last.items.push(tx)
    } else {
      groups.push({ date: tx.date, items: [tx] })
    }
  }
  return groups
}

/**
 * The status label for an activity row: a request has moved no money, a transfer may still be in
 * flight, anything else has landed.
 * @param {object} tx - Transaction or awaiting-payment row.
 * @returns {'Completed'|'Awaiting payment'|'Pending'}
 */
export function rowStatusOf(tx) {
  if (tx.kind === 'request') return 'Awaiting payment'
  if (tx.isPending) return 'Pending'
  return 'Completed'
}

/**
 * The sign shown before an amount. A request carries no direction, since nothing has moved yet.
 * @param {object} tx - Transaction or awaiting-payment row.
 * @returns {string} '+', '−', or ''.
 */
export function signOf(tx) {
  if (tx.kind === 'request') return ''
  return tx.amount > 0 ? '+' : '−'
}

/**
 * The text color class for an amount: muted for a request, the accent for money in, default for out.
 * @param {object} tx - Transaction or awaiting-payment row.
 * @returns {string} A Tailwind text color class.
 */
export function amountToneOf(tx) {
  if (tx.kind === 'request') return 'text-muted-foreground'
  return tx.amount > 0 ? 'text-secondary' : 'text-foreground'
}
