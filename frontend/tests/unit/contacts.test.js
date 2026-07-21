import { describe, it, expect } from 'vitest'
import { detectLookupType } from '@/lib/wallet/contacts'

// One field adds a contact by either address, so this is what decides which lookup Leafy Pay runs.
describe('detectLookupType', () => {
  it('reads an address with an @ as an email', () => {
    expect(detectLookupType('amara.okafor@back.es')).toBe('email')
  })

  it('reads a number as a phone, in the formats people actually type', () => {
    for (const value of ['+34 612 345 678', '+34612345678', '612345678', '+44 7712 345678']) {
      expect(detectLookupType(value)).toBe('phone')
    }
  })

  it('does not throw on nothing', () => {
    expect(detectLookupType('')).toBe('phone')
    expect(detectLookupType(undefined)).toBe('phone')
  })
})
