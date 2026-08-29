import type Redis from 'ioredis'
import { redisKeys } from './keys.js'
import type { ChatMessage } from '../chat.types.js'

export async function publishMessage(publisher: Redis, message: ChatMessage): Promise<void> {
  await publisher.publish(redisKeys.pubsubRoom(message.roomId), JSON.stringify(message))
}

/**
 * Subscribe once (via psubscribe) to all room chat and task channels and
 * dispatch to a local per-room delivery callback. This lets a single Realtime
 * instance receive messages published by any instance and fan them out only
 * to the WebSocket connections it locally owns for that room.
 *
 * Both chat (`pubsub:room:*:chat`) and host-task (`pubsub:room:*:task`)
 * messages are forwarded through the same callback — the payload is opaque
 * here and the connected clients route by the message's `type` field.
 */
export async function subscribeToAllRooms(subscriber: Redis, onMessage: (roomId: string, raw: string) => void): Promise<void> {
  await subscriber.psubscribe(redisKeys.pubsubRoomPattern, redisKeys.pubsubTaskRoomPattern)
  subscriber.on('pmessage', (_pattern, channel: string, payload: string) => {
    const roomId = channel.split(':')[2]
    if (roomId) onMessage(roomId, payload)
  })
}
