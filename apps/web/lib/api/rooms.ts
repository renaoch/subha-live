import { apiFetch } from "@/lib/api/client";
import type { RoomMediaType } from "@/lib/types";

interface RoomEnvelope<T> {
  success: boolean;
  data: T;
}

export interface RoomHost {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  country_flag: string | null;
  /**
   * Same role values used on PublicProfile/PrivateProfile:
   *   user | agency_owner | agency_agent | agency_admin | agency_host
   */
  role?: string | null;
  is_verified?: boolean;
  /** Platform admin / engineer — separate from agency ownership. */
  is_admin?: boolean;
  level?: number;
}

export interface RoomRecord {
  id: string;
  title: string;
  host_id: string;
  status: "created" | "live" | "ending" | "ended";
  category: string | null;
  cover: string | null;
  description: string | null;
  livekit_room_name: string;
  max_guest_slots: number;
  /** 'video' (camera + mic, default) or 'audio' (mic-only, no camera ever). */
  media_type: RoomMediaType;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
  host?: RoomHost | null;
  viewerCount?: number;
}

export interface CreateRoomInput {
  title: string;
  livekit_room_name: string;
  category?: string;
  cover?: string | null;
  description?: string | null;
  max_guest_slots?: number;
  /** Defaults to 'video' server-side if omitted. */
  media_type?: RoomMediaType;
}

export interface RoomMediaState {
  roomId: string;
  status: string;
  generation: number;
  sequence: number;
host: {
  userId: string;
  sessionId: string;
  status:
    | "connecting"
    | "connected"
    | "reconnecting"
    | "closing"
    | "closed"
    | "failed";
  videoTrackName: string;
  audioTrackName: string;
  /** Epoch ms when the 60s reconnect grace period ends. Only present
   * while status === "reconnecting" — drives the "please wait" countdown
   * viewers see instead of a silent freeze. */
  reconnectDeadline?: number;
} | null;
  speakers: Record<
    string,
    {
      userId: string;
      sessionId: string;
      audioTrackName: string;
      videoTrackName?: string;
      hasVideo?: boolean;
      status:
        | "connecting"
        | "connected"
        | "reconnecting"
        | "closing"
        | "closed"
        | "failed";
    }
  >;
  viewers: Record<string, unknown>;
  viewerCount: number;
  updatedAt: number;
}

export interface MediaTrackInput {
  trackName: string;
  kind: "audio" | "video";
  direction: "publish";
  mid: string;
}

export interface MediaPublishResult {
  session: {
    sessionId: string;
    generation: number;
    status: string;
  };
  answerSdp?: string;
  tracks: Array<{
    trackName: string;
    kind: "audio" | "video";
    direction: "publish" | "subscribe";
    mid?: string;
  }>;
  requiresRenegotiation: boolean;
}

export interface SpeakerRequest {
  id: string;
  room_id: string;
  user_id: string;
  requested_by: string | null;
  type: "audio" | "video";
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
  user?: {
    id: string;
    name: string;
    handle: string;
    avatar: string | null;
    public_id: string | null;
  } | null;
}
export interface MediaViewerResult {
  session: {
    sessionId: string;
    generation: number;
    status: string;
  };
  answerSdp?: string;
  offerSdp?: string;
  tracks: Array<{
    trackName: string;
    kind: "audio" | "video";
    direction: "publish" | "subscribe";
    mid?: string;
  }>;
  requiresRenegotiation: boolean;
  alreadySubscribed?: boolean; 
}

/** One seat on an audio party room's stage. `null` = empty seat. */
export interface StageSeatResult {
  seat: number;
  userId: string;
  status: "connecting" | "connected" | "reconnecting" | "offline";
  muted: boolean;
  speakingAt: number;
}

export interface StageParticipantResult {
  userId: string;
  status: "connecting" | "connected" | "reconnecting" | "offline";
  muted: boolean;
  speakingAt: number;
}

/** Response shape of `GET /rooms/:id/stage` (room-stage.service.ts). */
export interface StageSnapshotResult {
  roomId: string;
  status: string;
  mediaType: string;
  rev: number;
  serverTime: number;
  seatCount: number;
  listenerCount: number;
  requestCount: number;
  host: StageParticipantResult;
  seats: Array<StageSeatResult | null>;
  pollMs: { stage: number; listener: number };
  /** Only present when the request's `rev` was stale or omitted. */
  profiles?: Record<string, { name: string; avatar: string | null }>;
  me: {
    seat: number | null;
    isHost: boolean;
    requestPending: boolean;
  };
}

export const roomsApi = {
  list() {
    return apiFetch<RoomEnvelope<RoomRecord[]>>("/api/v1/rooms").then(
      (r) => r.data,
    );
  },

  create(input: CreateRoomInput) {
    return apiFetch<RoomEnvelope<RoomRecord>>("/api/v1/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  get(id: string) {
    return apiFetch<RoomEnvelope<RoomRecord>>(`/api/v1/rooms/${id}`).then(
      (r) => r.data,
    );
  },

  start(id: string) {
    return apiFetch<RoomEnvelope<RoomRecord>>(`/api/v1/rooms/${id}/start`, {
      method: "POST",
    }).then((r) => r.data);
  },

  end(id: string) {
    return apiFetch<RoomEnvelope<RoomRecord>>(`/api/v1/rooms/${id}/end`, {
      method: "POST",
    }).then((r) => r.data);
  },

  join(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/api/v1/rooms/${id}/join`, {
      method: "POST",
    });
  },

  leave(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/api/v1/rooms/${id}/leave`, {
      method: "POST",
    });
  },

  getMediaState(id: string) {
    return apiFetch<RoomEnvelope<RoomMediaState>>(
      `/api/v1/rooms/${id}/media`,
    ).then((r) => r.data);
  },

  publishHost(
    id: string,
    input: {
      offerSdp: string;
      tracks: MediaTrackInput[];
    },
  ) {
    return apiFetch<RoomEnvelope<MediaPublishResult>>(
      `/api/v1/rooms/${id}/media/host/publish`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ).then((r) => r.data);
  },

  createViewerSession(
    id: string,
    offerSdp: string,
    preview = false,
    mode: "listener" | "stage" = "listener",
  ) {
    return apiFetch<RoomEnvelope<MediaViewerResult>>(
      `/api/v1/rooms/${id}/media/viewer/session`,
      {
        method: "POST",
        body: JSON.stringify({ offerSdp, preview, mode }),
      },
    ).then((r) => r.data);
  },

  /**
   * Audio party-room stage poll: seats, host, listener/request counts.
   * Also doubles as the listener's presence heartbeat, so plain
   * listeners never need to call `heartbeat()` separately (see
   * room-stage.service.ts on the API).
   */
  getStage(id: string, knownRev?: number) {
    const query = knownRev !== undefined ? `?rev=${knownRev}` : "";
    return apiFetch<RoomEnvelope<StageSnapshotResult>>(
      `/api/v1/rooms/${id}/stage${query}`,
    ).then((r) => r.data);
  },

  reportStage(id: string, input: { speaking?: boolean; muted?: boolean }) {
    return apiFetch<RoomEnvelope<null>>(`/api/v1/rooms/${id}/stage/report`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  leaveSeat(id: string) {
    return apiFetch<RoomEnvelope<null>>(`/api/v1/rooms/${id}/stage/seat`, {
      method: "DELETE",
    }).then((r) => r.data);
  },

  leaveViewer(id: string) {
    return apiFetch<RoomEnvelope<null>>(
      `/api/v1/rooms/${id}/media/viewer`,
      {
        method: "DELETE",
      },
    );
  },

  publishGuest(
    id: string,
    input: {
      offerSdp: string;
      tracks: MediaTrackInput[];
    },
  ) {
    return apiFetch<RoomEnvelope<MediaPublishResult>>(
      `/api/v1/rooms/${id}/media/guest/publish`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ).then((r) => r.data);
  },

  unpublishGuest(id: string) {
    return apiFetch<RoomEnvelope<null>>(
      `/api/v1/rooms/${id}/media/guest`,
      { method: "DELETE" },
    );
  },


subscribeHostToGuests(
  id: string,
  input: { offerSdp?: string; answerSdp?: string; speakerIds?: string[] },
) {
  return apiFetch<RoomEnvelope<MediaViewerResult>>(
    `/api/v1/rooms/${id}/media/host/subscribe`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  ).then((r) => r.data);
},

subscribeViewerToSpeakers(
  id: string,
  input: { offerSdp?: string; answerSdp?: string; speakerIds?: string[] },
) {
  return apiFetch<RoomEnvelope<MediaViewerResult>>(
    `/api/v1/rooms/${id}/media/viewer/subscribe`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  ).then((r) => r.data);
},
  listSpeakerRequests(id: string) {
    return apiFetch<RoomEnvelope<SpeakerRequest[]>>(
      `/api/v1/rooms/${id}/speaker-requests`,
    ).then((r) => r.data);
  },

  approveSpeakerRequest(id: string, requestId: string) {
    return apiFetch<RoomEnvelope<SpeakerRequest>>(
      `/api/v1/rooms/${id}/speaker-requests/${requestId}/approve`,
      { method: "POST" },
    ).then((r) => r.data);
  },

  rejectSpeakerRequest(id: string, requestId: string) {
    return apiFetch<RoomEnvelope<SpeakerRequest>>(
      `/api/v1/rooms/${id}/speaker-requests/${requestId}/reject`,
      { method: "POST" },
    ).then((r) => r.data);
  },

  completeRenegotiation(
    id: string,
    answerSdp: string,
  ) {
    return apiFetch<RoomEnvelope<null>>(
      `/api/v1/rooms/${id}/media/viewer/renegotiate`,
      {
        method: "POST",
        body: JSON.stringify({
          answerSdp,
        }),
      },
    );
  },

  heartbeat(
    id: string,
    input: {
      role: "host" | "speaker" | "viewer";
      sessionId: string;
      generation: number;
    },
  ) {
    return apiFetch<RoomEnvelope<unknown>>(
      `/api/v1/rooms/${id}/media/heartbeat`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  getMyRequestStatus(id: string) {
    return apiFetch<
      RoomEnvelope<{
        status: "pending" | "accepted" | "rejected" | "cancelled" | "none";
        type: "audio" | "video" | null;
        requestId: string | null;
      }>
    >(`/api/v1/rooms/${id}/speaker-requests/mine`).then((r) => r.data);
  },

  requestAudio(id: string) {
    return apiFetch<RoomEnvelope<SpeakerRequest>>(
      `/api/v1/rooms/${id}/audio-request`,
      {
        method: "POST",
        body: JSON.stringify({ type: "audio" }),
      },
    ).then((r) => r.data);
  },

  cancelAudioRequest(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(
      `/api/v1/rooms/${id}/audio-request`,
      {
        method: "DELETE",
      },
    );
  },

  getTurnCredentials() {
    return apiFetch<RoomEnvelope<{ iceServers: RTCIceServer[] }>>(
      `/api/v1/media/turn-credentials`,
    ).then((r) => r.data);
  },
};

export function mediaBadgeLabel(type: RoomMediaType) {
  return type === "video" ? "Video" : "Audio";
}

// Inside rooms.ts, update the MediaViewerResult interface (or create a new one)