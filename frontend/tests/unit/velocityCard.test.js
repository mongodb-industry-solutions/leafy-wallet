import { describe, it, expect } from 'vitest'
import { formatVelocity, pushVelocityChart } from '@/lib/ai/toolkit'

const ROWS = [
  { createdAt: '2026-08-10T14:03:00.000Z', amount: 10, currency: 'EUR', sendsInWindow: 4 },
  { createdAt: '2026-08-10T14:02:20.000Z', amount: 25.5, currency: 'EUR', sendsInWindow: 3 },
]

describe('velocity card', () => {
  it('builds one bar per flagged payment, valued by amount not total', () => {
    const charts = []
    pushVelocityChart(charts, ROWS)
    expect(charts).toHaveLength(1)
    expect(charts[0].title).toBe('Payments in a short burst')
    expect(charts[0].rows).toEqual([
      { label: '14:03', value: 10 },
      { label: '14:02', value: 25.5 },
    ])
  })

  it('leads the text with the busiest window', () => {
    const text = formatVelocity(ROWS)
    expect(text.split('\n')[0]).toBe('2 payment(s) flagged, up to 4 sent inside one short window.')
    expect(text).toContain('EUR 25.50')
  })
})
