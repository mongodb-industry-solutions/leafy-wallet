import { describe, it, expect } from 'vitest'
import { threadRows } from '@/components/wallet/people/threadRows'

const AMARA = 'ref-amara'
const LIAM = 'ref-liam'

const tx = (id, counterpartyRef, amount, createdAt) => ({
  id,
  reference: id,
  counterpartyRef,
  amount,
  note: 'lunch',
  createdAt,
})

const TRANSACTIONS = [
  tx('t3', AMARA, -11.99, '2026-08-04T15:22:00.000Z'),
  tx('t2', LIAM, -95, '2026-08-02T19:57:00.000Z'),
  tx('t1', AMARA, 18.93, '2026-08-01T12:04:00.000Z'),
]

// The thread is one contact's history read as a conversation, so order and who-it-belongs-to matter.
describe('threadRows', () => {
  it('keeps only what passed between the user and that contact', () => {
    expect(threadRows(TRANSACTIONS, [], AMARA).map((r) => r.id)).toEqual(['t1', 't3'])
  })

  it('reads oldest first, so the newest payment sits at the bottom', () => {
    const rows = threadRows(TRANSACTIONS, [], AMARA)
    expect(new Date(rows[0].createdAt) < new Date(rows[1].createdAt)).toBe(true)
  })

  it('includes a request still awaiting payment, in date order', () => {
    const pending = [
      {
        id: 'r1',
        reference: 'r1',
        counterpartyRef: AMARA,
        amount: 40,
        note: 'hotel',
        status: 'pending',
        createdAt: '2026-08-03T09:00:00.000Z',
      },
    ]
    const rows = threadRows(TRANSACTIONS, pending, AMARA)
    expect(rows.map((r) => r.id)).toEqual(['t1', 'r1', 't3'])
    expect(rows[1].kind).toBe('request')
  })

  it('leaves out a resolved request, which already has its payment row', () => {
    const resolved = [{ id: 'r2', counterpartyRef: AMARA, amount: 40, status: 'paid', createdAt: '2026-08-03T09:00:00.000Z' }]
    expect(threadRows(TRANSACTIONS, resolved, AMARA).map((r) => r.id)).toEqual(['t1', 't3'])
  })

  it('does not throw on nothing', () => {
    expect(threadRows(undefined, undefined, AMARA)).toEqual([])
    expect(threadRows(TRANSACTIONS, [], undefined)).toEqual([])
    expect(threadRows(TRANSACTIONS, [], 'ref-nobody')).toEqual([])
  })
})
