// deploy/src/modules/rooms/room-participant.service.ts
//
// FIX: joinRoom() used to do THREE sequential Supabase round-trips before
// a viewer could even start their WebRTC handshake:
//   1. select rooms (check status)
//   2. select room_participants (check if a row already exists)
//   3. either insert OR update room_participants
// Each of those is a separate network hop to Postgres. Serially, that's
// ~150-450ms before /join even resolves — and the frontend was awaiting
// this ENTIRE call before starting the WebRTC session (see page.tsx fix).
//
// FIX: steps 2+3 are collapsed into a single `upsert` with
// onConflict on (room_id, user_id). That removes one full round trip.
// The room-status check stays separate because it needs to produce a
// different error code (409 ROOM_NOT_LIVE) than a plain upsert failure.
//
// REQUIRES: a unique constraint on (room_id, user_id) in room_participants.
// If you don't already have one:
//   ALTER TABLE room_participants
//     ADD CONSTRAINT room_participants_room_user_unique UNIQUE (room_id, user_id);

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomState } from "./room-state.service";
import type { Tables, TablesInsert } from "../../types/database.types";

type RoomParticipant = Tables<"room_participants">;

type JoinRoomInput = Pick<
  TablesInsert<"room_participants">,
  "room_id" | "user_id" | "role"
>;

export const roomParticipantService = {
  async joinRoom(input: JoinRoomInput): Promise<RoomParticipant> {
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

    // Single round trip: insert a fresh row, or if (room_id, user_id)
    // already exists, update it back to "joined" in the same statement.
    const { data, error } = await supabase
      .from("room_participants")
      .upsert(
        {
          room_id: input.room_id,
          user_id: input.user_id,
          role: input.role,
          joined_at: new Date().toISOString(),
          left_at: null,
        },
        { onConflict: "room_id,user_id" },
      )
      .select()
      .single();

    if (error) {
      throw new AppError(500, "Failed to join room", {
        code: "ROOM_JOIN_FAILED",
        details: error.message,
      });
    }

    // Fire-and-forget: the caller (frontend) doesn't need to wait on the
    // Redis viewer-count bump to get its response back. This alone can
    // shave meaningful time off the /join response on a loaded Redis.
    roomState.addViewer(input.room_id, input.user_id).catch((err) => {
      console.error("[roomParticipantService] addViewer failed:", err);
    });

    return data;
  },

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const { data: participant, error: fetchError } = await supabase
      .from("room_participants")
      .select("room_id, user_id, left_at")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      throw new AppError(500, "Failed to fetch room participant", {
        code: "ROOM_PARTICIPANT_FETCH_FAILED",
        details: fetchError.message,
      });
    }

    if (!participant) {
      throw new AppError(404, "Room participant not found", {
        code: "ROOM_PARTICIPANT_NOT_FOUND",
      });
    }

    if (participant.left_at) {
      await roomState.removeViewer(roomId, userId);
      return;
    }

    const { error: updateError } = await supabase
      .from("room_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (updateError) {
      throw new AppError(500, "Failed to leave room", {
        code: "ROOM_LEAVE_FAILED",
        details: updateError.message,
      });
    }

    await roomState.removeViewer(roomId, userId);
  },
};