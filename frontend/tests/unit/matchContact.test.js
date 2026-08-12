import { describe, it, expect } from 'vitest'
import { matchContact, resolveDraft } from '@/lib/ai/toolkit'

const CONTACTS = [
  { name: 'Amara Okafor', reference: 'ref-amara' },
  { name: 'Liam Chen', reference: 'ref-liam' },
  { name: 'Sofía García', reference: 'ref-sofia' },
]

const nameOf = (contacts, spoken) => matchContact(contacts, spoken).match?.name ?? null

// Dictation is what decides who a spoken payment goes to, and it mangles unusual names.
describe('matchContact', () => {
  it('matches a name typed exactly, whatever the case', () => {
    expect(nameOf(CONTACTS, 'Amara Okafor')).toBe('Amara Okafor')
    expect(nameOf(CONTACTS, 'amara okafor')).toBe('Amara Okafor')
  })

  it('matches on a first name alone when only one contact has it', () => {
    expect(nameOf(CONTACTS, 'Liam')).toBe('Liam Chen')
  })

  it('ignores accents, so a name can be spelled without them', () => {
    expect(nameOf(CONTACTS, 'Sofia Garcia')).toBe('Sofía García')
  })

  it('recovers a surname that speech-to-text split or misheard', () => {
    for (const heard of ['Amara O Kafor', 'Amara Okafour', 'Amara Ocafor', 'Amara Oh Kafor']) {
      expect(nameOf(CONTACTS, heard)).toBe('Amara Okafor')
    }
  })

  it('ignores filler the model passed along with the name', () => {
    expect(nameOf(CONTACTS, 'my friend Liam Chen')).toBe('Liam Chen')
  })

  it('asks instead of guessing when two contacts fit alike', () => {
    const twins = [
      { name: 'Liam Chen', reference: 'ref-liam' },
      { name: 'Liam Chan', reference: 'ref-liam-2' },
    ]
    const { match, rivals } = matchContact(twins, 'Liam Chun')
    expect(match).toBeNull()
    expect(rivals.map((c) => c.name).sort()).toEqual(['Liam Chan', 'Liam Chen'])
  })

  it('asks when a shared first name fits several contacts', () => {
    const twins = [
      { name: 'Liam Chen', reference: 'ref-liam' },
      { name: 'Liam Novak', reference: 'ref-liam-2' },
    ]
    expect(matchContact(twins, 'Liam').rivals).toHaveLength(2)
  })

  it('does not reach for an unrelated contact', () => {
    expect(nameOf(CONTACTS, 'Priya Raman')).toBeNull()
  })

  it('does not throw on nothing', () => {
    expect(nameOf(CONTACTS, '')).toBeNull()
    expect(nameOf(CONTACTS, undefined)).toBeNull()
    expect(nameOf([], 'Amara')).toBeNull()
  })
})

describe('resolveDraft', () => {
  const draftFor = (spoken, contacts = CONTACTS) => {
    const drafts = []
    const text = resolveDraft(contacts, { contact_name: spoken, amount: 20, note: 'lunch', mode: 'send' }, drafts)
    return { text, drafts }
  }

  it('drafts against the resolved contact and names them back', () => {
    const { text, drafts } = draftFor('Amara Okafour')
    expect(drafts).toHaveLength(1)
    expect(drafts[0].contact.reference).toBe('ref-amara')
    expect(text).toContain('Amara Okafor')
  })

  it('drafts nothing and asks when the name is ambiguous', () => {
    const twins = [
      { name: 'Liam Chen', reference: 'ref-liam' },
      { name: 'Liam Chan', reference: 'ref-liam-2' },
    ]
    const { text, drafts } = draftFor('Liam Chun', twins)
    expect(drafts).toHaveLength(0)
    expect(text).toContain('Liam Chen or Liam Chan')
  })

  it('drafts nothing and lists the contacts when nothing fits', () => {
    const { text, drafts } = draftFor('Priya Raman')
    expect(drafts).toHaveLength(0)
    expect(text).toContain('No contact matches')
    expect(text).toContain('Amara Okafor')
  })
})
