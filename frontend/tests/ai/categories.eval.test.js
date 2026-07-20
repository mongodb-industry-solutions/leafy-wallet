import { describe, it, expect } from 'vitest'
import { classifyNotes } from '@/lib/wallet/categories'

// nomic-embed embeddings and the nearest-category match are deterministic, so these mappings are
// stable and can be asserted exactly. This is the real check that spending categorization works,
// online or offline, since both paths run this same classifier.
describe('spending category classification', () => {
  it('maps payment notes to sensible categories via embeddings', async () => {
    const cats = await classifyNotes([
      'rent',
      'dinner at the italian place',
      'uber to airport',
      'groceries at the supermarket',
      'concert tickets',
      'pharmacy pickup',
      'No note',
    ])
    expect(cats).toEqual([
      'Bills & Utilities',
      'Dining',
      'Transport',
      'Groceries',
      'Entertainment',
      'Health',
      'Other',
    ])
  }, 60000)
})
