// Redis keys for PK (shared with the Core API — keep names in sync).
export const pkKeys = {
  state: (battleId: string) => `pk:${battleId}:state`,
  host: (hostId: string) => `pk:host:${hostId}`,
  battleChannel: (battleId: string) => `pubsub:pk:${battleId}`,
  battleChannelPattern: 'pubsub:pk:*',
  hostChannel: (hostId: string) => `pubsub:pkh:${hostId}`,
  hostChannelPattern: 'pubsub:pkh:*',
} as const
