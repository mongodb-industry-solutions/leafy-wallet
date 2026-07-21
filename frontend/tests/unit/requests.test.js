import { describe, it, expect } from 'vitest'
import { isAwaitingPayer, toRequestPaymentRows, toRequestStatus } from '@/lib/wallet/requests'

// Leafy Pay models a payment request in sixteen states and the wallet renders five, so this mapping
// is what decides whether a request is payable and how it reads in the list.
describe('toRequestStatus', () => {
  it('treats every pre-decision state as pending', () => {
    for (const s of ['draft', 'created', 'validated', 'presented', 'delivered', 'viewed']) {
      expect(toRequestStatus(s)).toBe('pending')
    }
  })

  it('counts a request as paid from approval onward, not just once settled', () => {
    for (const s of ['accepted', 'payment_initiated', 'payment_processing', 'payment_settled']) {
      expect(toRequestStatus(s)).toBe('paid')
    }
  })

  it('keeps a request paid when the payment is later reversed or disputed', () => {
    // The request was answered; what happened to the money afterwards is the transaction's story.
    expect(toRequestStatus('reversed')).toBe('paid')
    expect(toRequestStatus('disputed')).toBe('paid')
  })

  it('maps the ways a request ends without being paid', () => {
    expect(toRequestStatus('rejected')).toBe('declined')
    expect(toRequestStatus('cancelled')).toBe('cancelled')
    expect(toRequestStatus('expired')).toBe('expired')
    expect(toRequestStatus('payment_failed')).toBe('failed')
  })
})

describe('isAwaitingPayer', () => {
  it('is true only while the payer has not decided', () => {
    expect(isAwaitingPayer('presented')).toBe(true)
    expect(isAwaitingPayer('viewed')).toBe(true)
    expect(isAwaitingPayer('accepted')).toBe(false)
    expect(isAwaitingPayer('rejected')).toBe(false)
    expect(isAwaitingPayer('expired')).toBe(false)
  })

  it('never treats a status it does not recognize as actionable', () => {
    // Guards the Pay/Decline controls: an unknown state must not invite paying something twice.
    expect(isAwaitingPayer('some_future_status')).toBe(false)
    expect(isAwaitingPayer(undefined)).toBe(false)
  })
})

const incoming = {
  reference: 'req-1',
  executionReference: 'exec-1',
  payeeName: 'Amara Okafor',
  payerCounterpartyRef: '',
  amount: 25,
  currency: 'EUR',
  note: 'dinner',
  status: 'payment_settled',
  createdAt: '2026-07-01T10:00:00Z',
  updatedAt: '2026-07-01T10:05:00Z',
  isIncoming: true,
}
const outgoing = { ...incoming, reference: 'req-2', executionReference: 'exec-2', payerCounterpartyRef: 'arr-9', isIncoming: false }

describe('toRequestPaymentRows', () => {
  it('gives the payer an outgoing row named after the requester', () => {
    // The payer never saved the requester as a contact, so the name is all they have to show.
    const [row] = toRequestPaymentRows([incoming], new Set())
    expect(row).toMatchObject({
      reference: 'exec-1',
      counterpartyRef: null,
      fallbackName: 'Amara Okafor',
      isReceived: false,
      magnitude: 25,
      status: 'completed',
    })
  })

  it('gives the payee an incoming row tied to the contact they asked', () => {
    const [row] = toRequestPaymentRows([outgoing], new Set())
    expect(row).toMatchObject({ counterpartyRef: 'arr-9', fallbackName: '', isReceived: true })
  })

  it('yields to anything Leafy Pay already reported, so a payment is never listed twice', () => {
    expect(toRequestPaymentRows([incoming], new Set(['exec-1']))).toEqual([])
  })

  it('skips requests that produced no payment', () => {
    const pending = { ...incoming, executionReference: null, status: 'presented' }
    expect(toRequestPaymentRows([pending], new Set())).toEqual([])
  })

  it('marks a payment still on its way as pending', () => {
    const inFlight = { ...incoming, status: 'payment_processing' }
    expect(toRequestPaymentRows([inFlight], new Set())[0].status).toBe('pending')
  })

  it('dates the row from the approval, not from when the request was raised', () => {
    expect(toRequestPaymentRows([incoming], new Set())[0].createdAt).toBe('2026-07-01T10:05:00Z')
  })
})
