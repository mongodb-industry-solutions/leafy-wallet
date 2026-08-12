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

// How close a spoken name has to land before it counts as the contact, and how far it has to sit
// ahead of the runner-up. Tuned so a mangled surname still resolves while two similar contacts ask.
const NAME_MATCH_THRESHOLD = 0.68
const NAME_MATCH_MARGIN = 0.06

/** Case, accents and punctuation all survive dictation unreliably, so none of them are compared. */
const normalizeName = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Edit distance over two rows: the names being compared are short, so this stays cheap. */
function editDistance(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = row
  }
  return prev[b.length]
}

const similarity = (a, b) => {
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest
}

/** A spoken word that opens a longer name is that name: "cath" is Catherine, not a half match. */
function tokenSimilarity(token, nameToken) {
  if (token.length >= 3 && nameToken.startsWith(token)) return 0.95
  return similarity(token, nameToken)
}

/**
 * How well a heard name fits a saved one. Scored two ways because dictation fails two ways: it splits
 * and joins words ("Okafor" → "Oh Kaffor"), which only the space-stripped form survives, and it drops
 * or adds whole words, which only the per-word form survives. The better of the two wins.
 */
function scoreName(needle, name) {
  const needleTokens = needle.split(' ')
  let matched = 0
  let weight = 0
  // Scored as how much of the saved name the spoken words cover, so a stray "my friend" is simply
  // unused rather than counted against the hit — while a wrong surname still leaves the name uncovered.
  for (const nameToken of name.split(' ')) {
    matched += Math.max(...needleTokens.map((t) => tokenSimilarity(t, nameToken))) * nameToken.length
    weight += nameToken.length
  }
  const perToken = weight === 0 ? 0 : matched / weight
  return Math.max(similarity(needle.replace(/ /g, ''), name.replace(/ /g, '')), perToken)
}

/**
 * Pick the contact a name refers to, tolerating how badly speech-to-text mangles unusual names.
 * Exact and substring matches win outright; anything else has to clear a similarity bar *and* beat
 * the runner-up, so two look-alike contacts come back as a question instead of a guess. The draft
 * card is still the confirm step — this only decides who to propose.
 * @param {{name: string}[]} contacts - The saved contacts to match against.
 * @param {string} spoken - The name as heard or typed.
 * @returns {{match: object|null, rivals: object[]}} `rivals` is set when the name fits several.
 */
export function matchContact(contacts, spoken) {
  const needle = normalizeName(spoken)
  if (!needle || contacts.length === 0) return { match: null, rivals: [] }

  const exact = contacts.find((c) => normalizeName(c.name) === needle)
  if (exact) return { match: exact, rivals: [] }
  const contained = contacts.filter((c) => normalizeName(c.name).includes(needle))
  if (contained.length === 1) return { match: contained[0], rivals: [] }
  if (contained.length > 1) return { match: null, rivals: contained }

  const [best, runnerUp] = contacts
    .map((contact) => ({ contact, score: scoreName(needle, normalizeName(contact.name)) }))
    .sort((a, b) => b.score - a.score)
  if (best.score < NAME_MATCH_THRESHOLD) return { match: null, rivals: [] }
  if (runnerUp && best.score - runnerUp.score < NAME_MATCH_MARGIN) {
    return { match: null, rivals: [best.contact, runnerUp.contact] }
  }
  return { match: best.contact, rivals: [] }
}

/**
 * Resolve a drafted payment against the saved contacts and push it for confirmation. Assumes the note
 * is already cleaned and non-empty (the caller applies the note guard first). Returns the tool text.
 */
export function resolveDraft(contacts, { contact_name, amount, note, mode }, drafts) {
  const { match, rivals } = matchContact(contacts, contact_name)
  if (rivals.length > 0) {
    const names = rivals.map((c) => c.name).join(' or ')
    return `"${contact_name}" could be ${names}. Ask the user which one they meant, then call draft_payment again with that full name.`
  }
  if (!match) {
    const names = contacts.map((c) => c.name).join(', ')
    return `No contact matches "${contact_name}". Saved contacts: ${names || 'none'}.`
  }
  drafts.push({ contact: match, amount, note, mode })
  return `Drafted a ${mode} of ${money(amount)} ${mode === 'request' ? 'from' : 'to'} ${match.name}. The draft is awaiting the user's confirmation on a card; tell them to review and confirm it.`
}
