import { apiFetch } from "@/lib/api/client";
import type { RoomMediaType } from "@/lib/types";

interface RoomEnvelope<T> {
  success: boolean;
  data: T;
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
}

export interface CreateRoomInput {
  title: string;
  livekit_room_name: string;
  category?: string;
  cover?: string | null;
  description?: string | null;
  max_guest_slots?: number;
}

export const roomsApi = {
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
    return apiFetch<RoomEnvelope<unknown>>(` /api/v1/rooms/${id}/join`, {
      method: "POST",
    });
  },

  leave(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/api/v1/rooms/${id}/leave`, {
      method: "POST",
    });
  },

  requestAudio(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/api/v1/rooms/${id}/audio-request`, {
      method: "POST",
    });
  },

  cancelAudioRequest(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/api/v1/rooms/${id}/audio-request`, {
      method: "DELETE",
    });
  },
};

export function mediaBadgeLabel(type: RoomMediaType) {
  return type === "video" ? "Video Room" : "Audio Room";
}
