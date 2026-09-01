export type ChatMessage = {
  id: string
  roomId: string
  userId: string
  username: string
  avatar: string | null
  message: string
  createdAt: number
}

export type Authorization = {
  username: string
  avatar: string | null
  canAccess: boolean
  isMember?: boolean
  isHost?: boolean
  isModerator?: boolean
  isMuted?: boolean
  isBanned?: boolean
  /** Whether this user may SEND messages (host + mutual friends only). */
  canChat?: boolean
}

export type AuthorizedContext = Authorization & { userId: string }

export interface CoreApiAdapter {
  resolve(userId: string, roomId: string, accessToken: string): Promise<Authorization>
}

export interface AuthorizationCache {
  resolve(userId: string, roomId: string, accessToken: string): Promise<Authorization>
  invalidate(userId: string, roomId?: string): Promise<void>
}

export type Cursor = { createdAt: number; id: string }

export const messageId = (): string => `msg_${crypto.randomUUID()}`

export function parseCursor(cursor: string | undefined | null): Cursor | undefined {
  if (!cursor) return undefined
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as Cursor
    if (!Number.isFinite(parsed.createdAt) || !parsed.id) return undefined
    return parsed
  } catch {
    return undefined
  }
}

export function makeCursor(value: Cursor): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function errorEnvelope(code: string, message: string) {
  return { error: { code, message } }
}

export function wsError(code: string, message: string) {
  return { type: 'error' as const, code, message }
}

export class ChatError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
  }
}