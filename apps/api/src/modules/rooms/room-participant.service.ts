import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomState } from "./room-state.service";
import { roomMediaService } from "./room-media.service";
import type {
  Tables,
  TablesInsert,
} from "../../types/database.types";

type RoomParticipant = Tables<"room_participants">;

type JoinRoomInput = Pick<
  TablesInsert<"room_participants">,
  "room_id" | "user_id" | "role"
>;

export const roomParticipantService = {
  async joinRoom(
    input: JoinRoomInput,
  ): Promise<RoomParticipant> {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("id", input.room_id)
      .maybeSingle();

    if (roomError) {
      throw new AppError(
        500,
        "Failed to fetch room",
        {
          code: "ROOM_FETCH_FAILED",
          details: roomError.message,
        },
      );
    }

    if (!room) {
      throw new AppError(
        404,
        "Room not found",
        {
          code: "ROOM_NOT_FOUND",
        },
      );
    }

    if (room.status !== "live") {
      throw new AppError(
        409,
        "Room is not live",
        {
          code: "ROOM_NOT_LIVE",
        },
      );
    }

    const { data: existing, error: existingError } =
      await supabase
        .from("room_participants")
        .select("*")
        .eq("room_id", input.room_id)
        .eq("user_id", input.user_id)
        .maybeSingle();

    if (existingError) {
      throw new AppError(
        500,
        "Failed to check room participant",
        {
          code: "ROOM_PARTICIPANT_CHECK_FAILED",
          details: existingError.message,
        },
      );
    }

    if (existing) {
      if (!existing.left_at) {
        return existing;
      }

      const { data, error } = await supabase
        .from("room_participants")
        .update({
          joined_at: new Date().toISOString(),
          left_at: null,
          role: input.role,
        })
        .eq("room_id", input.room_id)
        .eq("user_id", input.user_id)
        .select()
        .single();

      if (error) {
        throw new AppError(
          500,
          "Failed to rejoin room",
          {
            code: "ROOM_REJOIN_FAILED",
            details: error.message,
          },
        );
      }

      await roomState.addViewer(
        input.room_id,
        input.user_id,
      );

      return data;
    }

    const participant: TablesInsert<"room_participants"> = {
      room_id: input.room_id,
      user_id: input.user_id,
      role: input.role,
      joined_at: new Date().toISOString(),
      left_at: null,
    };

    const { data, error } = await supabase
      .from("room_participants")
      .insert(participant)
      .select()
      .single();

    if (error) {
      throw new AppError(
        500,
        "Failed to join room",
        {
          code: "ROOM_JOIN_FAILED",
          details: error.message,
        },
      );
    }

    await roomState.addViewer(
      input.room_id,
      input.user_id,
    );

    return data;
  },

  async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const { data: participant, error: fetchError } =
      await supabase
        .from("room_participants")
        .select("room_id, user_id, left_at, role")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();

    if (fetchError) {
      throw new AppError(
        500,
        "Failed to fetch room participant",
        {
          code: "ROOM_PARTICIPANT_FETCH_FAILED",
          details: fetchError.message,
        },
      );
    }

    if (!participant) {
      throw new AppError(
        404,
        "Room participant not found",
        {
          code: "ROOM_PARTICIPANT_NOT_FOUND",
        },
      );
    }

    if (participant.left_at) {
      await roomState.removeViewer(roomId, userId);
      return;
    }

    const { error } = await supabase
      .from("room_participants")
      .update({
        left_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .is("left_at", null);

    if (error) {
      throw new AppError(
        500,
        "Failed to leave room",
        {
          code: "ROOM_LEAVE_FAILED",
          details: error.message,
        },
      );
    }

    await roomState.removeViewer(roomId, userId);

    if (participant.role === "speaker") {
      await roomMediaService.unpublishGuest(roomId, userId).catch(() => {});
    }
  },
};