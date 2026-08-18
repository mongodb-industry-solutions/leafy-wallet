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

  // What the "Split the bill" chip sends. One card per person in a single turn, and requests rather
  // than sends: the user already paid, so a split asks for the shares back.
  it('splits a bill into one request per person, for the shares that add up', async () => {
    const { drafts } = await runTurn('Split my €40 dinner evenly between me, Luis and Priya')

    expect(drafts).toHaveLength(2)
    expect(drafts.map((d) => d.mode)).toEqual(['request', 'request'])
    expect(drafts.map((d) => d.contact.name.toLowerCase().split(' ')[0]).sort()).toEqual([
      'luis',
      'priya',
    ])
    // Three shares of a €40 bill: the two requested ones leave the user their own third.
    for (const draft of drafts) expect(draft.amount).toBeCloseTo(40 / 3, 1)
  })
})

// Offline the tool set is a strict subset and the reads come off the device, so the checks here are
// that the shared tools behave identically rather than that every answer matches.
describe('Leafy assistant · offline parity', () => {
  it('draws a spending chart offline too', async () => {
    const { calls, charts } = await runTurn('How much did I spend this week?', { isOnline: false })
    expect(called(calls, 'get_spending_by_contact')).toBe(true)
    expect(charts.length).toBeGreaterThan(0)
  })

  it('answers a balance question from the device cache', async () => {
    const { reply, calls } = await runTurn("What's my balance?", { isOnline: false })
    expect(called(calls, 'get_balance')).toBe(true)
    expect(reply).toMatch(/1[,.]?493/)
  })

  it('still drafts a payment offline, to be queued for replay', async () => {
    const { drafts } = await runTurn('Send €50 to Luis for the team dinner', { isOnline: false })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].amount).toBe(50)
    expect(drafts[0].contact.name.toLowerCase()).toContain('luis')
  })
})
