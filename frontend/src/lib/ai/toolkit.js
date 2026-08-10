// Pure tool helpers shared by the live tools (tools.js) and the eval stubs (tests/helpers/stubTools.js).
// No server-only imports, so the harness exercises the exact formatting, note guard, and draft
// resolution the app ships instead of re-implementing them.

// The inline chart card fits about this many bars before it stops being glanceable.
const CHART_MAX_ROWS = 6

export const money = (n, currency = 'EUR') => `${currency} ${Math.abs(n).toFixed(2)}`

/** The card renders the note as "For <note>", so store the bare phrase: drop a leading "for ", trim. */
export const cleanNote = (note) => (note ?? '').trim().replace(/^for\s+/i, '').trim()

const totalOf = (rows) => rows.reduce((sum, r) => sum + r.total, 0)
const currencyOf = (rows) => rows[0].currency ?? 'EUR'

// One breakdown as a chart card: the bars are capped, and `toLabel` names each row.
function pushChart(charts, title, rows, toLabel, toValue = (r) => r.total) {
  charts.push({
    title,
    rows: rows.slice(0, CHART_MAX_ROWS).map((r) => ({ label: toLabel(r), value: toValue(r) })),
  })
}

/** Record a per-contact spending breakdown for the inline chart card. */
export function pushSpendingChart(charts, direction, rows) {
  const title = direction === 'received' ? 'Received by contact' : 'Sent by contact'
  pushChart(charts, title, rows, (r) => r.contact)
}

/**
 * Text form of a per-contact spending breakdown. The same rows render as a chart card, so this leads
 * with the pre-computed total (the model reads it rather than summing) and then lists each contact.
 */
export function formatSpending(rows, direction) {
  const label = direction === 'received' ? 'received' : 'sent'
  const verb = direction === 'received' ? 'received from' : 'sent to'
  const lines = rows.map((r) => `${verb} ${r.contact}: ${money(r.total, r.currency)} across ${r.count} payment(s)`)
  const header = `Total ${label}: ${money(totalOf(rows), currencyOf(rows))} across ${rows.length} contact(s).`
  return [header, ...lines].join('\n')
}

/** Record a by-category spending breakdown (emoji-prefixed labels) for the inline chart card. */
export function pushCategoryChart(charts, rows) {
  pushChart(charts, 'Spending by category', rows, (r) => `${r.emoji} ${r.category}`)
}

/** Text form of a by-category spending breakdown, leading with the pre-computed total. */
export function formatCategory(rows) {
  const currency = currencyOf(rows)
  const lines = rows.map((r) => `${r.emoji} ${r.category}: ${money(r.total, currency)} across ${r.count} payment(s)`)
  const header = `Total spent: ${money(totalOf(rows), currency)} across ${rows.length} categories.`
  return [header, ...lines].join('\n')
}

/** Record a flagged burst for the inline card: one bar per payment, so the cluster is visible. */
export function pushVelocityChart(charts, rows) {
  pushChart(
    charts,
    'Payments in a short burst',
    rows,
    (r) => new Date(r.createdAt).toISOString().slice(11, 16),
    (r) => r.amount,
  )
}

/** Text form of a flagged burst, leading with the worst window the model should quote. */
export function formatVelocity(rows) {
  const busiest = Math.max(...rows.map((r) => r.sendsInWindow))
  const lines = rows.map(
    (r) => `${new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')}: ${money(r.amount, r.currency)}`,
  )
  const header = `${rows.length} payment(s) flagged, up to ${busiest} sent inside one short window.`
  return [header, ...lines].join('\n')
}

/** The prompt the draft tool returns when the note is missing, so the model asks before drafting. */
export const noteGuardMessage = (mode) =>
  `Ask the user what this ${mode} is for, in a short question, then call draft_payment again with their answer as the note.`

/**
 * Resolve a drafted payment against the saved contacts and push it for confirmation. Assumes the note
 * is already cleaned and non-empty (the caller applies the note guard first). Returns the tool text.
 */
export function resolveDraft(contacts, { contact_name, amount, note, mode }, drafts) {
  const needle = contact_name.trim().toLowerCase()
  const match =
    contacts.find((c) => c.name.toLowerCase() === needle) ??
    contacts.find((c) => c.name.toLowerCase().includes(needle))
  if (!match) {
    const names = contacts.map((c) => c.name).join(', ')
    return `No contact matches "${contact_name}". Saved contacts: ${names || 'none'}.`
  }
  drafts.push({ contact: match, amount, note, mode })
  return `Drafted a ${mode} of ${money(amount)} ${mode === 'request' ? 'from' : 'to'} ${match.name}. The draft is awaiting the user's confirmation on a card; tell them to review and confirm it.`
}
