import { describe, it, expect, beforeAll } from 'vitest'
import { assertModelReady } from '../helpers/model'
import { runTurn } from '../helpers/runTurn'
import { STUB_DATA } from '../helpers/stubTools'

// get_transaction_velocity is the one tool with no offline twin: the window aggregation behind it
// runs in Atlas. These evals cover the routing into it, that a finding reaches the user as a card,
// and that an offline turn neither reaches for it nor makes one up.
const called = (calls, name) => calls.some((c) => c.name === name)

// Figures only the velocity tool knows, so either one appearing offline is an invented answer.
const BURST_ONLY_FIGURES = [/240/, /690/]

beforeAll(async () => {
  await assertModelReady()
})

describe('Leafy assistant · fraud signals', () => {
  it('checks velocity when asked whether anything looks unusual', async () => {
    const { calls, charts } = await runTurn('Has anything unusual happened on my account?')
    expect(called(calls, 'get_transaction_velocity')).toBe(true)
    expect(charts.some((c) => c.title === 'Payments in a short burst')).toBe(true)
  })

  it('reports the burst it was given instead of an all-clear', async () => {
    const { reply, calls } = await runTurn('Did someone else use my account?')
    expect(called(calls, 'get_transaction_velocity')).toBe(true)
    expect(reply).not.toMatch(/nothing (unusual|suspicious)|no (unusual|suspicious)/i)
    expect(reply.length).toBeLessThan(320) // a summary, not the whole burst re-listed
  })

  it('says all-clear on an empty result, with no card', async () => {
    const data = { ...STUB_DATA, velocity: [] }
    const { reply, calls, charts } = await runTurn('Is there any suspicious activity?', { data })
    expect(called(calls, 'get_transaction_velocity')).toBe(true)
    expect(charts).toHaveLength(0)
    expect(reply).toMatch(/nothing|no unusual|no suspicious|all (good|clear)|did not find|didn't find/i)
  })

  it('does not treat an ordinary spending question as a fraud check', async () => {
    const { calls } = await runTurn('How much did I spend this week?')
    expect(called(calls, 'get_transaction_velocity')).toBe(false)
  })

  it('has no velocity tool offline, and invents no burst without one', async () => {
    const { reply, calls } = await runTurn('Has anything unusual happened on my account?', { isOnline: false })
    expect(called(calls, 'get_transaction_velocity')).toBe(false)
    for (const figure of BURST_ONLY_FIGURES) expect(reply).not.toMatch(figure)
  })
})
