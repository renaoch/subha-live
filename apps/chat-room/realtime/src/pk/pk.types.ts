// PK types for the realtime service (mirrors the Core API's pk.types.ts —
// the two services have no shared package). The realtime service only READS
// hot state and FORWARDS events; it never writes scores or final results.

export type PkStatus =
  | 'IDLE'
  | 'INVITED'
  | 'ACCEPTED'
  | 'STARTING'
  | 'ACTIVE'
  | 'FINALIZING'
  | 'FINISHED'
  | 'CANCELLED'

export interface PkHotState {
  battleId: string
  status: PkStatus
  hostA: string
  hostB: string
  roomA: string
  roomB: string
  scoreA: number
  scoreB: number
  startedAt: number | null
  endsAt: number | null
  version: number
}

export type PkEventType =
  | 'PK_INVITE'
  | 'PK_ACCEPT'
  | 'PK_DECLINE'
  | 'PK_START'
  | 'PK_TIME_SYNC'
  | 'PK_SCORE_UPDATE'
  | 'PK_GIFT_EVENT'
  | 'PK_END'
  | 'PK_RESULT'
  | 'PK_CANCEL'
  | 'PK_STATE_SYNC'
