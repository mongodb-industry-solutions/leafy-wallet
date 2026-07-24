import { describe, it, expect } from 'vitest'
import { recoverToolCalls } from '@/lib/ai/graph'

const NAMES = ['draft_payment', 'get_spending_by_contact', 'get_balance']

// The exact text shapes qwen2.5 writes when it narrates a call instead of emitting one. Recovering
// them is what keeps a send from silently doing nothing when Ollama fails to parse the call.
describe('recoverToolCalls', () => {
  it('recovers a {"name","arguments"} object embedded in prose', () => {
    const content =
      'Sure. {"name": "draft_payment", "arguments": {"contact_name": "Luis", "amount": 50, "note": "team dinner", "mode": "send"}}'
    expect(recoverToolCalls(content, NAMES)).toEqual([
      {
        name: 'draft_payment',
        args: { contact_name: 'Luis', amount: 50, note: 'team dinner', mode: 'send' },
        id: 'rec_0',
        type: 'tool_call',
      },
    ])
  })

  it('recovers a bare args object written after the tool name', () => {
    const content = 'draft_payment {"contact_name": "Luis", "amount": 50, "mode": "send", "note": "lunch"}'
    const [call] = recoverToolCalls(content, NAMES)
    expect(call.name).toBe('draft_payment')
    expect(call.args.amount).toBe(50)
    expect(call.args.note).toBe('lunch')
  })

  it('recovers a name(key="value") kwargs call', () => {
    const content = 'draft_payment(contact_name="Luis", amount=50, mode="send", note="team dinner")'
    expect(recoverToolCalls(content, NAMES)).toEqual([
      {
        name: 'draft_payment',
        args: { contact_name: 'Luis', amount: 50, mode: 'send', note: 'team dinner' },
        id: 'rec_0',
        type: 'tool_call',
      },
    ])
  })

  it('recovers a natural-language "called with" narration', () => {
    const content =
      "draft_payment called with contact_name 'Luis', amount 50, mode 'send', and note 'team dinner'."
    expect(recoverToolCalls(content, NAMES)).toEqual([
      {
        name: 'draft_payment',
        args: { contact_name: 'Luis', amount: 50, mode: 'send', note: 'team dinner' },
        id: 'rec_0',
        type: 'tool_call',
      },
    ])
  })

  it('does not double-recover the same call from two shapes', () => {
    const content = 'draft_payment {"contact_name": "Luis", "amount": 50, "mode": "send", "note": "x"}'
    expect(recoverToolCalls(content, NAMES)).toHaveLength(1)
  })

  it('recovers a <tool_call>-wrapped call', () => {
    const content = '<tool_call>\n{"name": "get_spending_by_contact", "arguments": {"direction": "sent"}}\n</tool_call>'
    expect(recoverToolCalls(content, NAMES)[0]).toMatchObject({
      name: 'get_spending_by_contact',
      args: { direction: 'sent' },
    })
  })

  it('ignores plain prose and unknown tool names', () => {
    expect(recoverToolCalls('Drafting the payment to Luis for dinner.', NAMES)).toEqual([])
    expect(recoverToolCalls('{"name": "unknown_tool", "arguments": {}}', NAMES)).toEqual([])
  })

  it('returns [] for non-string content', () => {
    expect(recoverToolCalls(null, NAMES)).toEqual([])
    expect(recoverToolCalls(['x'], NAMES)).toEqual([])
  })
})
