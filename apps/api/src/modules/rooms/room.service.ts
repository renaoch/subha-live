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

export interface RoomAuthorization {
  canAccess: boolean;
  isHost: boolean;
  isMember: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isBanned: boolean;
  /** Whether this user may SEND chat messages (host + mutual friends only). */
  canChat: boolean;
}

/** True when userA and userB follow each other (mutual friends). */
async function areFriends(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return true;
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .or(
      `and(follower_id.eq.${userA},following_id.eq.${userB}),and(follower_id.eq.${userB},following_id.eq.${userA})`,
    );
  return !error && (data?.length ?? 0) >= 2;
}

export const roomService = {
  /**
   * Resolve a user's authorization to chat in a room. This is the contract
   * the live-room realtime service (apps/chat-room/realtime) depends on via
   * `CORE_API_AUTH_ENDPOINT` — it owns no membership data and asks the Core
   * API instead.
   *
   * Room-level mute/ban is not modeled yet (the app has user-level mute/block
   * for DMs, not room chat), so those are reported as `false` until such a
   * system exists. The realtime service treats `isBanned` as "deny access".
   */
  async authorize(roomId: string, userId: string): Promise<RoomAuthorization> {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host_id, status")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) {
      throw new AppError(500, "Failed to fetch room", {
        code: "ROOM_FETCH_FAILED",
        details: roomError.message,
      });
    }

    if (!room) {
      throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
    }

    const isHost = room.host_id === userId;

    const { data: participant } = await supabase
      .from("room_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    const isMember = isHost || !!participant;
    const isModerator = participant?.role === "moderator";
    const canChat = isHost || (await areFriends(userId, room.host_id));

    return {
      // Chat is available in waiting + live rooms; an ended room closes chat.
      canAccess: room.status !== "ended",
      isHost,
      isMember,
      isModerator,
      isMuted: false,
      isBanned: false,
      canChat,
    };
  },

  async listRooms(): Promise<Room[]> {
    // Same host join as getRoomById, so list cards can show the host's
    // avatar/name/badges without a second request per room. Excludes
    // "ended" rooms — the frontend splits what's left into "live" vs
    // "waiting" (created) client-side.
    const { data, error } = await supabase
      .from("rooms")
      .select(
        `*, host:profiles!rooms_host_id_fkey (
          id, name, handle, avatar, country_flag, role, is_admin, is_verified, level
        )`,
      )
      .neq("status", "ended")
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(
        500,
        "Failed to list rooms",
        {
          code: "ROOM_LIST_FAILED",
          details: error.message,
        },
      );
    }

    return (data ?? []) as unknown as Room[];
  },

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