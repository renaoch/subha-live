import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomState } from "./room-state.service";
import type {
  Tables,
  TablesInsert,
} from "../../types/database.types";

type RoomJoinRequest = Tables<"room_join_requests">;

type CreateAudioRequestInput = Pick<
  TablesInsert<"room_join_requests">,
  "room_id" | "user_id" | "type"
>;

export const roomRequestService = {
  async createAudioRequest(
    input: CreateAudioRequestInput,
  ): Promise<RoomJoinRequest> {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("id", input.room_id)
      .maybeSingle();

    if (roomError) {
      throw new AppError(500, "Failed to fetch room", {
        code: "ROOM_FETCH_FAILED",
        details: roomError.message,
      });
    }

    if (!room) {
      throw new AppError(404, "Room not found", {
        code: "ROOM_NOT_FOUND",
      });
    }

    if (room.status !== "live") {
      throw new AppError(409, "Room is not live", {
        code: "ROOM_NOT_LIVE",
      });
    }

    const { data: participant, error: participantError } =
      await supabase
        .from("room_participants")
        .select("role, left_at")
        .eq("room_id", input.room_id)
        .eq("user_id", input.user_id)
        .maybeSingle();

    if (participantError) {
      throw new AppError(
        500,
        "Failed to check room participant",
        {
          code: "ROOM_PARTICIPANT_CHECK_FAILED",
          details: participantError.message,
        },
      );
    }

    if (!participant || participant.left_at) {
      throw new AppError(
        403,
        "You must join the room before requesting audio",
        {
          code: "ROOM_PARTICIPANT_REQUIRED",
        },
      );
    }

    if (participant.role === "speaker") {
      throw new AppError(
        409,
        "You are already a speaker",
        {
          code: "ALREADY_SPEAKER",
        },
      );
    }

    const { data: existingRequest, error: requestCheckError } =
      await supabase
        .from("room_join_requests")
        .select("*")
        .eq("room_id", input.room_id)
        .eq("user_id", input.user_id)
        .eq("type", "audio")
        .eq("status", "pending")
        .maybeSingle();

    if (requestCheckError) {
      throw new AppError(
        500,
        "Failed to check audio request",
        {
          code: "AUDIO_REQUEST_CHECK_FAILED",
          details: requestCheckError.message,
        },
      );
    }

    if (existingRequest) {
      return existingRequest;
    }

    const request: TablesInsert<"room_join_requests"> = {
      room_id: input.room_id,
      user_id: input.user_id,
      type: input.type,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("room_join_requests")
      .insert(request)
      .select()
      .single();

    if (error) {
      throw new AppError(
        500,
        "Failed to create audio request",
        {
          code: "AUDIO_REQUEST_CREATE_FAILED",
          details: error.message,
        },
      );
    }

    await roomState.addAudioRequest(
      input.room_id,
      input.user_id,
    );

    return data;
  },

  async cancelAudioRequest(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const { data: request, error: requestError } =
      await supabase
        .from("room_join_requests")
        .select("id, status")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .eq("type", "audio")
        .eq("status", "pending")
        .maybeSingle();

    if (requestError) {
      throw new AppError(
        500,
        "Failed to fetch audio request",
        {
          code: "AUDIO_REQUEST_FETCH_FAILED",
          details: requestError.message,
        },
      );
    }

    if (!request) {
      throw new AppError(
        404,
        "Pending audio request not found",
        {
          code: "AUDIO_REQUEST_NOT_FOUND",
        },
      );
    }

    const { error } = await supabase
      .from("room_join_requests")
      .update({
        status: "cancelled",
      })
      .eq("id", request.id)
      .eq("status", "pending");

    if (error) {
      throw new AppError(
        500,
        "Failed to cancel audio request",
        {
          code: "AUDIO_REQUEST_CANCEL_FAILED",
          details: error.message,
        },
      );
    }

    await roomState.removeAudioRequest(
      roomId,
      userId,
    );
  },
};