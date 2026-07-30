import 'server-only'
import { embed } from '@/lib/ai/embeddings'

// Spending categories, each anchored by a short descriptor that the embedding matches notes against.
// "Other" catches empty notes and anything that lands closest to it.
const CATEGORIES = [
  { label: 'Dining', emoji: '🍽️', hint: 'restaurant, cafe, coffee, lunch, dinner, drinks, takeout, bar' },
  { label: 'Groceries', emoji: '🛒', hint: 'supermarket, groceries, food shopping, market' },
  { label: 'Transport', emoji: '🚕', hint: 'taxi, ride, fuel, gas, train, bus, metro, parking, flight' },
  { label: 'Bills & Utilities', emoji: '🧾', hint: 'rent, electricity, water, internet, phone, insurance, subscription' },
  { label: 'Entertainment', emoji: '🎬', hint: 'movie, concert, game, streaming, event, nightlife, tickets' },
  { label: 'Shopping', emoji: '🛍️', hint: 'clothes, shoes, electronics, online order, gift' },
  { label: 'Health', emoji: '💊', hint: 'pharmacy, doctor, dentist, gym, wellness' },
  { label: 'Other', emoji: '💸', hint: 'miscellaneous, transfer, cash, split, uncategorized' },
]

const EMPTY_NOTES = new Set(['', 'no note'])
const OTHER = 'Other'
const EMOJI_BY_LABEL = new Map(CATEGORIES.map((c) => [c.label, c.emoji]))

/** The emoji for a category label. */
export const emojiForCategory = (label) => EMOJI_BY_LABEL.get(label)

// Category vectors are embedded once; note -> category is memoized so repeat queries don't re-embed.
let categoryVectorsPromise = null
const noteCategoryCache = new Map()

/** Euclidean length of a vector. */
function normOf(v) {
  let total = 0
  for (let i = 0; i < v.length; i++) total += v[i] * v[i]
  return Math.sqrt(total)
}

/** Cosine similarity of two equal-length vectors, given their precomputed norms. */
function cosine(a, b, normA, normB) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot / (normA * normB || 1)
}

function getCategoryVectors() {
  if (!categoryVectorsPromise) {
    categoryVectorsPromise = embed(CATEGORIES.map((c) => `${c.label}: ${c.hint}`))
      .then((vectors) =>
        CATEGORIES.map((c, i) => ({ label: c.label, vector: vectors[i], norm: normOf(vectors[i]) })),
      )
      .catch((error) => {
        categoryVectorsPromise = null
        throw error
      })
  }
  return categoryVectorsPromise
}

const normalize = (note) => (note ?? '').trim().toLowerCase()

/** Does a note carry text worth embedding (i.e. not blank or the "No note" placeholder)? */
const hasNoteText = (note) => Boolean(note) && !EMPTY_NOTES.has(normalize(note))

/**
 * Assign each note to its nearest spending category by embedding similarity, using the same model as
 * the notes' stored vectors. Empty notes go to "Other". Results are memoized per note.
 * @param {string[]} notes
 * @returns {Promise<string[]>} A category label per input note, in order.
 */
export async function classifyNotes(notes) {
  const categoryVectors = await getCategoryVectors()
  const toEmbed = [...new Set(notes.filter((n) => hasNoteText(n) && !noteCategoryCache.has(n)))]
  if (toEmbed.length > 0) {
    const vectors = await embed(toEmbed)
    toEmbed.forEach((note, i) => {
      let best = OTHER
      let bestScore = -Infinity
      const noteNorm = normOf(vectors[i])
      for (const category of categoryVectors) {
        const score = cosine(vectors[i], category.vector, noteNorm, category.norm)
        if (score > bestScore) {
          bestScore = score
          best = category.label
        }
      }
      noteCategoryCache.set(note, best)
    })
  }
  return notes.map((n) => (hasNoteText(n) ? noteCategoryCache.get(n) : OTHER))
}
