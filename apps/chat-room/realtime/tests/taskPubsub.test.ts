import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import { subscribeToAllRooms } from '../src/chat/redis/pubsub.js'

class FakeSubscriber extends EventEmitter {
  patterns: string[] = []
  async psubscribe(...patterns: string[]) {
    this.patterns.push(...patterns)
  }
}

describe('subscribeToAllRooms', () => {
  it('subscribes to both the chat and host-task room patterns', async () => {
    const sub = new FakeSubscriber()
    await subscribeToAllRooms(sub as any, () => {})
    expect(sub.patterns).toContain('pubsub:room:*:chat')
    expect(sub.patterns).toContain('pubsub:room:*:task')
  })

  it('routes chat and task messages to the callback with the correct room id', async () => {
    const sub = new FakeSubscriber()
    const received: Array<{ roomId: string; raw: string }> = []
    await subscribeToAllRooms(sub as any, (roomId, raw) => received.push({ roomId, raw }))

    sub.emit('pmessage', 'pubsub:room:*:chat', 'pubsub:room:r1:chat', '{"type":"connected"}')
    sub.emit('pmessage', 'pubsub:room:*:task', 'pubsub:room:r1:task', '{"type":"task.progress.updated","taskId":"t1"}')

    expect(received).toEqual([
      { roomId: 'r1', raw: '{"type":"connected"}' },
      { roomId: 'r1', raw: '{"type":"task.progress.updated","taskId":"t1"}' },
    ])
  })
})
