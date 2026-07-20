// Pure tool helpers shared by the live tools (tools.js) and the eval stubs (tests/helpers/stubTools.js).
// No server-only imports, so the harness exercises the exact formatting, note guard, and draft
// resolution the app ships instead of re-implementing them.

// The inline chart card fits about this many bars before it stops being glanceable.
const CHART_MAX_ROWS = 6

export const money = (n, currency = 'EUR') => `${currency} ${Math.abs(n).toFixed(2)}`

/** The card renders the note as "For <note>", so store the bare phrase: drop a leading "for ", trim. */
export const cleanNote = (note) => (note ?? '').trim().replace(/^for\s+/i, '').trim()

/** Record a per-contact spending breakdown for the inline chart card. */
export function pushSpendingChart(charts, direction, rows) {
  charts.push({
    title: direction === 'received' ? 'Received by contact' : 'Sent by contact',
    rows: rows.slice(0, CHART_MAX_ROWS).map((r) => ({ label: r.contact, value: r.total })),
  })
}

/**
 * Text form of a per-contact spending breakdown. The same rows render as a chart card, so this leads
 * with the pre-computed total (the model reads it rather than summing) and then lists each contact.
 */
export function formatSpending(rows, direction) {
  const label = direction === 'received' ? 'received' : 'sent'
  const verb = direction === 'received' ? 'received from' : 'sent to'
  const currency = rows[0]?.currency ?? 'EUR'
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  const lines = rows.map((r) => `${verb} ${r.contact}: ${money(r.total, r.currency)} across ${r.count} payment(s)`)
  return [`Total ${label}: ${money(total, currency)} across ${rows.length} contact(s).`, ...lines].join('\n')
}

/** Record a by-category spending breakdown (emoji-prefixed labels) for the inline chart card. */
export function pushCategoryChart(charts, rows) {
  charts.push({
    title: 'Spending by category',
    rows: rows.slice(0, CHART_MAX_ROWS).map((r) => ({ label: `${r.emoji} ${r.category}`, value: r.total })),
  })
}

/** Text form of a by-category spending breakdown, leading with the pre-computed total. */
export function formatCategory(rows) {
  const currency = rows[0]?.currency ?? 'EUR'
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  const lines = rows.map((r) => `${r.emoji} ${r.category}: ${money(r.total, currency)} across ${r.count} payment(s)`)
  return [`Total spent: ${money(total, currency)} across ${rows.length} categories.`, ...lines].join('\n')
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
