import { describe, it, expect } from 'vitest'
import { parseMcpResult } from '@/lib/ai/mcp'

// These are the exact shapes @langchain/mcp-adapters hands back from the backend's FastMCP tools.
// The single-block object shape used to fall through and crash the caller with `.map is not a
// function`, which surfaced as "there was an issue retrieving the spending details".
describe('parseMcpResult', () => {
  it('unwraps a single content block (structuredContent) to an array', () => {
    const input = {
      type: 'text',
      text: '{"contact":"Leafy Pay user","total":161.54}',
      structuredContent: { result: [{ contact: 'Leafy Pay user', total: 161.54 }] },
    }
    expect(parseMcpResult(input)).toEqual([{ contact: 'Leafy Pay user', total: 161.54 }])
  })

  it('parses an array of text blocks into rows', () => {
    const input = [
      { type: 'text', text: '{"contact":"Luis","total":80.23}' },
      { type: 'text', text: '{"contact":"Maria","total":54.17}' },
    ]
    expect(parseMcpResult(input)).toEqual([
      { contact: 'Luis', total: 80.23 },
      { contact: 'Maria', total: 54.17 },
    ])
  })

  it('returns an empty array for an empty result', () => {
    expect(parseMcpResult([])).toEqual([])
    expect(parseMcpResult('')).toEqual([])
  })

  it('handles a bare JSON string (array or object)', () => {
    expect(parseMcpResult('[{"contact":"Luis"}]')).toEqual([{ contact: 'Luis' }])
    expect(parseMcpResult('{"contact":"Luis"}')).toEqual([{ contact: 'Luis' }])
  })

  it('never returns a non-array the caller would crash on', () => {
    for (const shape of [{ type: 'text', text: '{"a":1}', structuredContent: { result: [{ a: 1 }] } }, [], '']) {
      expect(Array.isArray(parseMcpResult(shape))).toBe(true)
    }
  })
})
