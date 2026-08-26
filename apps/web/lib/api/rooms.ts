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
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
  host?: RoomHost | null;
  viewerCount?: number;
  mediaType?: RoomMediaType;
}

export interface CreateRoomInput {
  title: string;
  livekit_room_name: string;
  category?: string;
  cover?: string | null;
  description?: string | null;
  max_guest_slots?: number;
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
} | null;
  speakers: Record<
    string,
    {
      userId: string;
      sessionId: string;
      audioTrackName: string;
      videoTrackName?: string;
      hasVideo?: boolean;
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

  createViewerSession(id: string, offerSdp: string) {
    return apiFetch<RoomEnvelope<MediaViewerResult>>(
      `/api/v1/rooms/${id}/media/viewer/session`,
      {
        method: "POST",
        body: JSON.stringify({ offerSdp }),
      },
    ).then((r) => r.data);
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
    input: { offerSdp?: string; answerSdp?: string },
  ) {
    return apiFetch<RoomEnvelope<MediaViewerResult>>(
      `/api/v1/rooms/${id}/media/host/subscribe`,
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
};

export function mediaBadgeLabel(type: RoomMediaType) {
  return type === "video" ? "Video" : "Audio";
}
