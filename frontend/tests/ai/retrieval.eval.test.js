import { describe, it, expect, beforeAll } from 'vitest'
import { assertModelReady } from '../helpers/model'
import { runTurn } from '../helpers/runTurn'

// Online, search_transactions is hybrid ($rankFusion over Atlas history); offline it is ObjectBox's
// vector index over what the device still holds. These evals pin the two differences a user feels:
// an exact reference is findable online, and history reaches further back than the device does.
const firstSearch = (calls) => calls.find((c) => c.name === 'search_transactions')

beforeAll(async () => {
  await assertModelReady()
})

describe('Leafy assistant · hybrid search online', () => {
  it('finds a payment by its invoice reference and ranks it first', async () => {
    const { reply, calls } = await runTurn('How much was the payment with reference INV-2291?')
    const search = firstSearch(calls)
    expect(search).toBeDefined()
    expect(search.output.split('\n')[0]).toContain('INV-2291')
    expect(reply).toMatch(/120/)
  })

  it('reaches transactions older than the device keeps', async () => {
    const { calls } = await runTurn('Have I ever bought coffee beans?')
    expect(firstSearch(calls)?.output).toContain('coffee beans subscription')
  })
})

describe('Leafy assistant · vector search on device', () => {
  it('answers a semantic question with no network', async () => {
    const { reply, calls } = await runTurn('What did I spend on coffee?', { isOnline: false })
    expect(firstSearch(calls)?.output).toContain('morning coffee')
    expect(reply).toMatch(/4[.,]50|4\.5\b/)
  })

  it('does not reach the history only Atlas holds', async () => {
    const { calls } = await runTurn('Have I ever bought coffee beans?', { isOnline: false })
    expect(firstSearch(calls)?.output).not.toContain('coffee beans subscription')
  })

  it('cannot find a payment by its reference, and does not answer anyway', async () => {
    const { reply, calls } = await runTurn('How much was the payment with reference INV-2291?', { isOnline: false })
    const search = firstSearch(calls)
    expect(search).toBeDefined()
    expect(search.output).not.toContain('INV-2291')
    expect(reply).not.toMatch(/120/) // the amount is unreachable, so quoting it means inventing it
  })
})
