import { describe, it, expect } from 'vitest'
import { toPlainText } from '@/lib/ai/graph'

// The chat bubble renders text verbatim, so anything left here reaches the user as punctuation.
// Grove's hosted models format by default; the local one almost never does.
describe('toPlainText', () => {
  it('unwraps the bold a hosted model puts around an amount', () => {
    expect(toPlainText('You have **€1,493.20** across your accounts.')).toBe(
      'You have €1,493.20 across your accounts.',
    )
  })

  it('unwraps underscore bold and single-asterisk italics', () => {
    expect(toPlainText('__Luis__ owes you the *most* this week.')).toBe(
      'Luis owes you the most this week.',
    )
  })

  it('unwraps inline code, which models use for references', () => {
    expect(toPlainText('The transfer is `exec-1`.')).toBe('The transfer is exec-1.')
  })

  it('drops heading and bullet markers, keeping the line', () => {
    expect(toPlainText('## Spending\n- Luis: €50\n- Priya: €15')).toBe(
      'Spending\nLuis: €50\nPriya: €15',
    )
  })

  it('leaves a reply that is already plain prose untouched', () => {
    const reply = 'You spent €65.00 this week, most of it with Luis.'
    expect(toPlainText(reply)).toBe(reply)
  })

  it('keeps a negative amount opening a line, which looks like a bullet', () => {
    expect(toPlainText('-€50.00 went to Luis.')).toBe('-€50.00 went to Luis.')
  })

  it('keeps arithmetic that is not emphasis', () => {
    expect(toPlainText('That is 3 * 4 euros a week.')).toBe('That is 3 * 4 euros a week.')
  })
})
