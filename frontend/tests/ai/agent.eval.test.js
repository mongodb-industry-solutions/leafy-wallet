import { describe, it, expect, beforeAll } from 'vitest'
import { assertModelReady } from '../helpers/model'
import { runTurn } from '../helpers/runTurn'

// End-to-end evals: the real LangGraph graph and the real local model (stub tools) decide what to
// call and how to reply. Assertions check behavior - which tool ran, whether a card/chart was
// produced, the draft's fields - not exact wording, so they stay stable across runs at temperature 0.
const called = (calls, name) => calls.some((c) => c.name === name)

beforeAll(async () => {
  await assertModelReady()
})

describe('Leafy assistant · reading money', () => {
  it('answers a balance question from get_balance', async () => {
    const { reply, calls } = await runTurn("What's my balance?")
    expect(called(calls, 'get_balance')).toBe(true)
    expect(reply).toMatch(/1[,.]?493/)
  })

  it('draws a spending chart for "how much did I spend this week"', async () => {
    const { reply, calls, charts } = await runTurn('How much did I spend this week?')
    expect(called(calls, 'get_spending_by_contact')).toBe(true)
    expect(charts.length).toBeGreaterThan(0)
    expect(reply.length).toBeLessThan(240) // a takeaway, not a re-listing of every contact
  })

  it('draws a spending chart for "where did my money go"', async () => {
    const { calls, charts } = await runTurn('Where did my money go?')
    expect(called(calls, 'get_spending_by_contact')).toBe(true)
    expect(charts.length).toBeGreaterThan(0)
  })

  it('draws a category chart for "what are my spending categories"', async () => {
    const { calls, charts } = await runTurn('What are my spending categories?')
    expect(called(calls, 'get_spending_by_category')).toBe(true)
    expect(charts.length).toBeGreaterThan(0)
  })

  it('uses semantic search for a "what did I spend on X" question', async () => {
    const { calls } = await runTurn('What did I spend on coffee?')
    expect(called(calls, 'search_transactions')).toBe(true)
  })
})

describe('Leafy assistant · sending & requesting', () => {
  it('drafts a send with the note stored as a bare phrase', async () => {
    const { drafts } = await runTurn('Send €50 to Luis for the team dinner')
    expect(drafts).toHaveLength(1)
    const [draft] = drafts
    expect(draft.mode).toBe('send')
    expect(draft.amount).toBe(50)
    expect(draft.contact.name.toLowerCase()).toContain('luis')
    expect(draft.note.toLowerCase()).toBe('team dinner')
  })

  it('asks what the payment is for before drafting when no note is given', async () => {
    const { reply, drafts } = await runTurn('Send €50 to Luis')
    expect(drafts).toHaveLength(0)
    expect(reply).toContain('?')
  })

  it('re-drafts with the updated note on a follow-up', async () => {
    const history = [
      { role: 'user', text: 'Send €50 to Luis for lunch' },
      { role: 'assistant', text: 'Drafted a send of EUR 50.00 to Luis (Colleague). Please review and confirm the card.' },
    ]
    const { drafts } = await runTurn('Actually make the note "team dinner"', { history })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].note.toLowerCase()).toBe('team dinner')
    expect(drafts[0].amount).toBe(50)
  })

  it('drafts a request to the right contact', async () => {
    const { drafts } = await runTurn('Request €15 from Priya for the gift')
    expect(drafts).toHaveLength(1)
    expect(drafts[0].mode).toBe('request')
    expect(drafts[0].contact.name.toLowerCase()).toContain('priya')
  })
})

describe('Leafy assistant · offline parity', () => {
  it('draws a spending chart offline too', async () => {
    const { calls, charts } = await runTurn('How much did I spend this week?', { isOnline: false })
    expect(called(calls, 'get_spending_by_contact')).toBe(true)
    expect(charts.length).toBeGreaterThan(0)
  })
})
