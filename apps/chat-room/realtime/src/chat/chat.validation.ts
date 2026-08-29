import { z } from 'zod'
import type { Config } from '../infrastructure/config.js'

/** Client sends only content + type. Identity, id, and timestamp are server-owned. */
export function chatMessageInputSchema(config: Config) {
  return z.object({
    type: z.literal('chat_message'),
    message: z.string().trim().min(1).max(config.CHAT_MAX_MESSAGE_LENGTH),
  })
}

export const historyQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  token: z.string().optional(),
})

export function clampHistoryLimit(requested: number | undefined, config: Config): number {
  const fallback = config.CHAT_HISTORY_LIMIT
  const max = config.CHAT_HISTORY_MAX_LIMIT
  if (!requested || !Number.isFinite(requested) || requested <= 0) return fallback
  return Math.min(requested, max)
}
