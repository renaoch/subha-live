import { apiFetch } from "@/lib/api/client";
import type { RoomMediaType } from "@/lib/types";

// Matches apps/api/src/modules/rooms — response envelope is { success, data }.
interface RoomEnvelope<T> {
  success: boolean;
  data: T;
}

export interface RoomRecord {
  id: string;
  title: string;
  host_id: string;
  status: "scheduled" | "live" | "ended";
  category: string | null;
  cover: string | null;
  description: string | null;
  livekit_room_name: string;
  max_guest_slots: number;
}

export interface CreateRoomInput {
  title: string;
  livekit_room_name: string;
  category?: string;
  cover?: string;
  description?: string;
  max_guest_slots?: number;
}

export const roomsApi = {
  create(input: CreateRoomInput) {
    return apiFetch<RoomEnvelope<RoomRecord>>("/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  get(id: string) {
    return apiFetch<RoomEnvelope<RoomRecord>>(`/rooms/${id}`).then(
      (r) => r.data,
    );
  },

  start(id: string) {
    return apiFetch<RoomEnvelope<RoomRecord>>(`/rooms/${id}/start`, {
      method: "POST",
    }).then((r) => r.data);
  },

  end(id: string) {
    return apiFetch<RoomEnvelope<RoomRecord>>(`/rooms/${id}/end`, {
      method: "POST",
    }).then((r) => r.data);
  },

  join(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/rooms/${id}/join`, {
      method: "POST",
    });
  },

  leave(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/rooms/${id}/leave`, {
      method: "POST",
    });
  },

  requestAudio(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/rooms/${id}/audio-request`, {
      method: "POST",
    });
  },

  cancelAudioRequest(id: string) {
    return apiFetch<RoomEnvelope<unknown>>(`/rooms/${id}/audio-request`, {
      method: "DELETE",
    });
  },
};

export function mediaBadgeLabel(type: RoomMediaType) {
  return type === "video" ? "Video Room" : "Audio Room";
}