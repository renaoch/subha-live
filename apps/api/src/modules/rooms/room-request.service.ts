import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomState } from "./room-state.service";
import type {
  Tables,
  TablesInsert,
} from "../../types/database.types";

type RoomJoinRequest = Tables<"room_join_requests">;
type RequestType = "audio" | "video";

type CreateSpeakerRequestInput = {
  roomId: string;
  requesterId: string;
  targetUserId: string;
  type: RequestType; 
};

async function getRoom(roomId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, host_id, status, max_guest_slots")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to fetch room", {
      code: "ROOM_FETCH_FAILED",
      details: error.message,
    });
  }

  if (!data) {
    throw new AppError(404, "Room not found", {
      code: "ROOM_NOT_FOUND",
    });
  }

  if (data.status !== "live") {
    throw new AppError(409, "Room is not live", {
      code: "ROOM_NOT_LIVE",
    });
  }

  return data;
}

export const roomRequestService = {
  async createSpeakerRequest(
    input: CreateSpeakerRequestInput,
  ): Promise<RoomJoinRequest> {
    const room = await getRoom(input.roomId);

    const requesterIsHost = room.host_id === input.requesterId;
    const selfRequest = input.requesterId === input.targetUserId;

    if (!requesterIsHost && !selfRequest) {
      throw new AppError(403, "Only the host can invite another viewer", {
        code: "ROOM_REQUEST_NOT_AUTHORIZED",
      });
    }

    const { data: participant, error: participantError } = await supabase
      .from("room_participants")
      .select("role, left_at")
      .eq("room_id", input.roomId)
      .eq("user_id", input.targetUserId)
      .maybeSingle();

    if (participantError) {
      throw new AppError(500, "Failed to check room participant", {
        code: "ROOM_PARTICIPANT_CHECK_FAILED",
        details: participantError.message,
      });
    }

    if (!participant || participant.left_at) {
      throw new AppError(403, "Target user must be an active room participant", {
        code: "ROOM_PARTICIPANT_REQUIRED",
      });
    }

    if (participant.role === "speaker") {
      throw new AppError(409, "User is already a speaker", {
        code: "ALREADY_SPEAKER",
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("room_join_requests")
      .select("*")
      .eq("room_id", input.roomId)
      .eq("user_id", input.targetUserId)
      .eq("type", input.type)
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) {
      throw new AppError(500, "Failed to check existing request", {
        code: "ROOM_REQUEST_CHECK_FAILED",
        details: existingError.message,
      });
    }

    if (existing) return existing;

    const request: TablesInsert<"room_join_requests"> = {
      room_id: input.roomId,
      user_id: input.targetUserId,
      requested_by: input.requesterId,
      type: input.type,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("room_join_requests")
      .insert(request)
      .select()
      .single();

    if (error) {
      throw new AppError(500, "Failed to create speaker request", {
        code: "ROOM_REQUEST_CREATE_FAILED",
        details: error.message,
      });
    }

    await roomState.addAudioRequest(input.roomId, input.targetUserId);
    return data;
  },

  async cancelSpeakerRequest(
    roomId: string,
    userId: string,
    type: RequestType,
  ): Promise<void> {
    const { data: request, error: requestError } = await supabase
      .from("room_join_requests")
      .select("id, status, requested_by")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("type", type)
      .eq("status", "pending")
      .maybeSingle();

    if (requestError) {
      throw new AppError(500, "Failed to fetch request", {
        code: "ROOM_REQUEST_FETCH_FAILED",
        details: requestError.message,
      });
    }

    if (!request) {
      throw new AppError(404, "Pending request not found", {
        code: "ROOM_REQUEST_NOT_FOUND",
      });
    }

    if (request.requested_by && request.requested_by !== userId) {
      throw new AppError(403, "Only the requester can cancel this request", {
        code: "ROOM_REQUEST_CANCEL_NOT_AUTHORIZED",
      });
    }

    const { error } = await supabase
      .from("room_join_requests")
      .update({
        status: "cancelled",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("status", "pending");

    if (error) {
      throw new AppError(500, "Failed to cancel request", {
        code: "ROOM_REQUEST_CANCEL_FAILED",
        details: error.message,
      });
    }

    await roomState.removeAudioRequest(roomId, userId);
  },

  /*
   * Lets the requesting viewer poll the status of their own
   * most recent speak request without needing host privileges.
   * This is the source of truth the frontend should use to clear
   * "waiting for host" state — it reflects room_join_requests
   * directly instead of the SFU publish state, which is only
   * populated after the viewer has already started publishing.
   */
  async getMyRequestStatus(
    roomId: string,
    userId: string,
  ): Promise<{
    status: "pending" | "accepted" | "rejected" | "cancelled" | "none";
    type: RequestType | null;
    requestId: string | null;
  }> {
    const { data, error } = await supabase
      .from("room_join_requests")
      .select("id, status, type")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Failed to fetch request status", {
        code: "ROOM_REQUEST_STATUS_FAILED",
        details: error.message,
      });
    }

    if (!data) {
      return { status: "none", type: null, requestId: null };
    }

    return {
      status: data.status as "pending" | "accepted" | "rejected" | "cancelled",
      type: data.type as RequestType,
      requestId: data.id,
    };
  },

  async listPendingRequests(
    roomId: string,
    hostId: string,
  ): Promise<RoomJoinRequest[]> {
    const room = await getRoom(roomId);

    if (room.host_id !== hostId) {
      throw new AppError(403, "Only the room host can view requests", {
        code: "ROOM_HOST_REQUIRED",
      });
    }

    const { data, error } = await supabase
      .from("room_join_requests")
      .select("*, user:profiles!user_id(id, name, handle, avatar, public_id)")
      .eq("room_id", roomId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      throw new AppError(500, "Failed to fetch pending requests", {
        code: "ROOM_REQUEST_LIST_FAILED",
        details: error.message,
      });
    }

    return data ?? [];
  },

  async respondToRequest(
    roomId: string,
    requestId: string,
    hostId: string,
    decision: "approve" | "reject",
  ): Promise<RoomJoinRequest> {
    const room = await getRoom(roomId);

    if (room.host_id !== hostId) {
      throw new AppError(403, "Only the room host can approve requests", {
        code: "ROOM_HOST_REQUIRED",
      });
    }

    const { data: request, error: requestError } = await supabase
      .from("room_join_requests")
      .select("*")
      .eq("id", requestId)
      .eq("room_id", roomId)
      .eq("status", "pending")
      .maybeSingle();

    if (requestError) {
      throw new AppError(500, "Failed to fetch request", {
        code: "ROOM_REQUEST_FETCH_FAILED",
        details: requestError.message,
      });
    }

    if (!request) {
      throw new AppError(404, "Pending request not found", {
        code: "ROOM_REQUEST_NOT_FOUND",
      });
    }

    if (decision === "reject") {
      const { data, error } = await supabase
        .from("room_join_requests")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", request.id)
        .eq("status", "pending")
        .select()
        .single();

      if (error) {
        throw new AppError(500, "Failed to reject request", {
          code: "ROOM_REQUEST_REJECT_FAILED",
          details: error.message,
        });
      }

      await roomState.removeAudioRequest(roomId, request.user_id);
      return data;
    }

    const speakerAdded = await roomState.addSpeaker(
      roomId,
      request.user_id,
      Math.min(room.max_guest_slots ?? 3, 3),
    );

    if (!speakerAdded && !(await roomState.isSpeaker(roomId, request.user_id))) {
      throw new AppError(409, "All guest audio slots are occupied", {
        code: "AUDIO_SLOTS_FULL",
      });
    }

    let videoAdded = false;
    if (request.type === "video") {
      videoAdded = await roomState.addVideoSpeaker(roomId, request.user_id, 1);
      if (!videoAdded && !(await roomState.isVideoSpeaker(roomId, request.user_id))) {
        await roomState.removeSpeaker(roomId, request.user_id);
        throw new AppError(409, "The guest video slot is occupied", {
          code: "VIDEO_SLOT_FULL",
        });
      }
    }

    const { error: participantError } = await supabase
      .from("room_participants")
      .update({ role: "speaker" })
      .eq("room_id", roomId)
      .eq("user_id", request.user_id)
      .is("left_at", null);

    if (participantError) {
      if (videoAdded) await roomState.removeVideoSpeaker(roomId, request.user_id);
      await roomState.removeSpeaker(roomId, request.user_id);
      throw new AppError(500, "Failed to promote participant", {
        code: "ROOM_SPEAKER_PROMOTION_FAILED",
        details: participantError.message,
      });
    }

    const { data, error } = await supabase
      .from("room_join_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("status", "pending")
      .select()
      .single();

    if (error) {
      if (videoAdded) await roomState.removeVideoSpeaker(roomId, request.user_id);
      await roomState.removeSpeaker(roomId, request.user_id);
      await supabase
        .from("room_participants")
        .update({ role: "audience" })
        .eq("room_id", roomId)
        .eq("user_id", request.user_id);
      throw new AppError(500, "Failed to accept request", {
        code: "ROOM_REQUEST_ACCEPT_FAILED",
        details: error.message,
      });
    }

    await roomState.removeAudioRequest(roomId, request.user_id);
    return data;
  },

  async acceptHostInvitation(
    roomId: string,
    requestId: string,
    userId: string,
  ): Promise<RoomJoinRequest> {
    const room = await getRoom(roomId);

    const { data: request, error: requestError } = await supabase
      .from("room_join_requests")
      .select("*")
      .eq("id", requestId)
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (requestError) {
      throw new AppError(500, "Failed to fetch invitation", {
        code: "ROOM_INVITATION_FETCH_FAILED",
        details: requestError.message,
      });
    }

    if (!request) {
      throw new AppError(404, "Pending host invitation not found", {
        code: "ROOM_INVITATION_NOT_FOUND",
      });
    }

    if (request.requested_by !== room.host_id) {
      throw new AppError(403, "This request is not a host invitation", {
        code: "ROOM_INVITATION_INVALID",
      });
    }

    const speakerAdded = await roomState.addSpeaker(
      roomId,
      userId,
      Math.min(room.max_guest_slots ?? 3, 3),
    );

    if (!speakerAdded && !(await roomState.isSpeaker(roomId, userId))) {
      throw new AppError(409, "All guest audio slots are occupied", {
        code: "AUDIO_SLOTS_FULL",
      });
    }

    let videoAdded = false;
    if (request.type === "video") {
      videoAdded = await roomState.addVideoSpeaker(roomId, userId, 1);
      if (!videoAdded && !(await roomState.isVideoSpeaker(roomId, userId))) {
        await roomState.removeSpeaker(roomId, userId);
        throw new AppError(409, "The guest video slot is occupied", {
          code: "VIDEO_SLOT_FULL",
        });
      }
    }

    const { error: participantError } = await supabase
      .from("room_participants")
      .update({ role: "speaker" })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .is("left_at", null);

    if (participantError) {
      if (videoAdded) await roomState.removeVideoSpeaker(roomId, userId);
      await roomState.removeSpeaker(roomId, userId);
      throw new AppError(500, "Failed to accept host invitation", {
        code: "ROOM_INVITATION_ACCEPT_FAILED",
        details: participantError.message,
      });
    }

    const { data, error } = await supabase
      .from("room_join_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("status", "pending")
      .select()
      .single();

    if (error) {
      if (videoAdded) await roomState.removeVideoSpeaker(roomId, userId);
      await roomState.removeSpeaker(roomId, userId);
      await supabase
        .from("room_participants")
        .update({ role: "audience" })
        .eq("room_id", roomId)
        .eq("user_id", userId);
      throw new AppError(500, "Failed to finalize host invitation", {
        code: "ROOM_INVITATION_FINALIZE_FAILED",
        details: error.message,
      });
    }

    await roomState.removeAudioRequest(roomId, userId);
    return data;
  },

  async removeSpeaker(
    roomId: string,
    userId: string,
    requesterId: string,
  ): Promise<void> {
    const room = await getRoom(roomId);
    if (room.host_id !== requesterId) {
      throw new AppError(403, "Only the room host can remove a speaker", {
        code: "ROOM_HOST_REQUIRED",
      });
    }

    await roomState.removeVideoSpeaker(roomId, userId);
    await roomState.removeSpeaker(roomId, userId);

    const { error } = await supabase
      .from("room_participants")
      .update({ role: "audience" })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .is("left_at", null);

    if (error) {
      throw new AppError(500, "Failed to remove speaker", {
        code: "ROOM_SPEAKER_REMOVE_FAILED",
        details: error.message,
      });
    }
  },
};
