import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { Tables, TablesInsert } from "../../types/database.types";

type Room = Tables<"rooms">;
type CreateRoomInput = Pick<
  TablesInsert<"rooms">,
  | "title"
  | "host_id"
  | "livekit_room_name"
  | "category"
  | "cover"
  | "description"
  | "max_guest_slots"
>;

export const roomService = {
  async createRoom(input: CreateRoomInput): Promise<Room> {
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        title: input.title,
        host_id: input.host_id,
        livekit_room_name: input.livekit_room_name,
        category: input.category ?? null,
        cover: input.cover ?? null,
        description: input.description ?? null,
        max_guest_slots: input.max_guest_slots ?? 3,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(
        500,
        "Failed to create room",
        {
          code: "ROOM_CREATE_FAILED",
          details: error.message,
        },
      );
    }

    return data;
  },

  async getRoomById(roomId: string): Promise<Room> {
    // FIX: was `select("*")` on `rooms` only, so `host` on the response
    // was always undefined — the frontend was silently falling back to
    // mock host data. This joins the host's public profile fields
    // (including role/is_admin/is_verified/level, needed for the room
    // header badges) in the same round trip via the FK relationship.
    const { data, error } = await supabase
      .from("rooms")
      // NOTE: `profiles!rooms_host_id_fkey` assumes your FK constraint on
      // rooms.host_id -> profiles.id is named that (Supabase's default
      // pattern: `<table>_<column>_fkey`). If this 500s with a "could not
      // find relationship" error, either rename to your actual constraint
      // name (check it in Supabase Studio -> Database -> rooms -> host_id),
      // or swap this line for the simpler `profiles!host_id (...)` form,
      // which newer supabase-js versions can resolve from the column name
      // directly.
      .select(
        `*, host:profiles!rooms_host_id_fkey (
          id, name, handle, avatar, country_flag, role, is_admin, is_verified, level
        )`,
      )
      .eq("id", roomId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        500,
        "Failed to fetch room",
        {
          code: "ROOM_FETCH_FAILED",
          details: error.message,
        },
      );
    }

    if (!data) {
      throw new AppError(
        404,
        "Room not found",
        {
          code: "ROOM_NOT_FOUND",
        },
      );
    }

    return data as unknown as Room;
  },

  async startRoom(roomId: string, hostId: string): Promise<Room> {
    const room = await this.getRoomById(roomId);

    if (room.host_id !== hostId) {
      throw new AppError(
        403,
        "Only the room host can start the room",
        {
          code: "ROOM_HOST_REQUIRED",
        },
      );
    }

    if (room.status !== "created") {
      throw new AppError(
        409,
        "Room cannot be started from its current state",
        {
          code: "ROOM_INVALID_STATUS",
          details: {
            currentStatus: room.status,
          },
        },
      );
    }

    const { data, error } = await supabase
      .from("rooms")
      .update({
        status: "live",
        started_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .eq("status", "created")
      .select()
      .single();

    if (error) {
      throw new AppError(
        500,
        "Failed to start room",
        {
          code: "ROOM_START_FAILED",
          details: error.message,
        },
      );
    }

    return data;
  },

  async endRoom(roomId: string, hostId: string): Promise<Room> {
    const room = await this.getRoomById(roomId);

    if (room.host_id !== hostId) {
      throw new AppError(
        403,
        "Only the room host can end the room",
        {
          code: "ROOM_HOST_REQUIRED",
        },
      );
    }

    if (room.status !== "live") {
      throw new AppError(
        409,
        "Room is not currently live",
        {
          code: "ROOM_INVALID_STATUS",
          details: {
            currentStatus: room.status,
          },
        },
      );
    }

    const { data, error } = await supabase
      .from("rooms")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .eq("status", "live")
      .select()
      .single();

    if (error) {
      throw new AppError(
        500,
        "Failed to end room",
        {
          code: "ROOM_END_FAILED",
          details: error.message,
        },
      );
    }

    return data;
  },
};