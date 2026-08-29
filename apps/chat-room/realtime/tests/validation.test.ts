import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { chatMessageInputSchema, clampHistoryLimit } from '../src/chat/chat.validation.js'
import { loadConfig } from '../src/infrastructure/config.js'

const config = loadConfig()
const schema = chatMessageInputSchema(config)

describe('chatMessageInputSchema', () => {
  it('accepts a valid message', () => {
    const result = schema.parse({ type: 'chat_message', message: 'there is a ghost' })
    expect(result.message).toBe('there is a ghost')
  })

  it('rejects an empty message', () => {
    expect(() => schema.parse({ type: 'chat_message', message: '' })).toThrow(z.ZodError)
  })

  it('rejects a whitespace-only message', () => {
    expect(() => schema.parse({ type: 'chat_message', message: '   ' })).toThrow(z.ZodError)
  })

  it('rejects an oversized message', () => {
    const huge = 'a'.repeat(config.CHAT_MAX_MESSAGE_LENGTH + 1)
    expect(() => schema.parse({ type: 'chat_message', message: huge })).toThrow(z.ZodError)
  })

  it('rejects an invalid event type', () => {
    expect(() => schema.parse({ type: 'not_a_real_type', message: 'hi' })).toThrow(z.ZodError)
  })

  it('rejects a malformed payload missing message', () => {
    expect(() => schema.parse({ type: 'chat_message' })).toThrow(z.ZodError)
  })

  it('ignores any client-supplied identity or timestamp fields (server owns these)', () => {
    const result = schema.parse({
      type: 'chat_message',
      message: 'hello',
      id: 'client-supplied-id',
      userId: 'attacker',
      createdAt: 1,
    })
    expect(result).toEqual({ type: 'chat_message', message: 'hello' })
  })
})

describe('clampHistoryLimit', () => {
  it('uses the default when unspecified', () => {
    expect(clampHistoryLimit(undefined, config)).toBe(config.CHAT_HISTORY_LIMIT)
  })

  it('honors a requested limit under the max', () => {
    expect(clampHistoryLimit(50, config)).toBe(50)
  })

  it('bounds an oversized requested limit to the configured maximum', () => {
    expect(clampHistoryLimit(1_000_000, config)).toBe(config.CHAT_HISTORY_MAX_LIMIT)
  })

  it('falls back to default for zero/negative values', () => {
    expect(clampHistoryLimit(0, config)).toBe(config.CHAT_HISTORY_LIMIT)
    expect(clampHistoryLimit(-5, config)).toBe(config.CHAT_HISTORY_LIMIT)
  })
})
