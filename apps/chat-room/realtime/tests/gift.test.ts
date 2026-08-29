import { describe, expect, it } from 'vitest'
import { isGiftEvent, giftEventSchema } from '../src/chat/moderation/gift.js'

describe('gift event routing compatibility', () => {
  it('recognizes a well-formed externally-produced gift event', () => {
    expect(isGiftEvent({ type: 'gift_event', roomId: 'room1', payload: { giftId: 'rose' } })).toBe(true)
  })

  it('recognizes a gift event with no payload', () => {
    expect(isGiftEvent({ type: 'gift_event', roomId: 'room1' })).toBe(true)
  })

  it('rejects anything that is not a gift event', () => {
    expect(isGiftEvent({ type: 'chat_message', message: 'hi' })).toBe(false)
  })

  it('the schema only recognizes routing fields, never coins/wallet/balance data', () => {
    const shape = giftEventSchema.shape
    expect(Object.keys(shape)).toEqual(['type', 'roomId', 'payload'])
  })
})
