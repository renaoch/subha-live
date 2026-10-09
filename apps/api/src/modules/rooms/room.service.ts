import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { pkService } from "../pk/pk.service";
import { roomMediaService } from "./room-media.service";
import { roomState } from "./room-state.service";
import type { Tables, TablesInsert } from "../../types/database.types";

/**
 * Category chips shown on home-feed live cards. Anything else the client
 * sends is normalised to DEFAULT_ROOM_CATEGORY so the feed never renders an
 * arbitrary, unstyled label.
 */
export const ROOM_CATEGORIES = ["chat", "music", "party", "talent", "gaming"] as const;
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];
const DEFAULT_ROOM_CATEGORY: RoomCategory = "chat";
const MAX_TAGLINE_LENGTH = 60;

function normalizeCategory(value: unknown): RoomCategory {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (ROOM_CATEGORIES as readonly string[]).includes(v)
    ? (v as RoomCategory)
    : DEFAULT_ROOM_CATEGORY;
}

function normalizeTagline(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Collapse whitespace/newlines: the tagline is a single line on the card.
  const v = value.replace(/\s+/g, " ").trim().slice(0, MAX_TAGLINE_LENGTH);
  return v.length > 0 ? v : null;
}

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
  | "media_type"
>;

export interface RoomAuthorization {
  canAccess: boolean;
  isHost: boolean;
  isMember: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isBanned: boolean;
  /** Whether this user may SEND chat messages. Open to every viewer. */
  canChat: boolean;
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
    // Chat is open to every viewer in the room, not just the host's mutual
    // friends. (Room-level mute/ban, handled separately via isMuted/isBanned,
    // is still how an individual gets shut out of chat.)
    const canChat = true;

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

    const rooms = (data ?? []) as unknown as Array<Room & { viewerCount?: number }>;

    // Home-feed cards show a live viewer count. It lives in Redis (not in
    // Postgres), so attach it here. Only live rooms have viewers, and a Redis
    // hiccup must never take the whole feed down: fail open to 0 per room.
    await Promise.all(
      rooms.map(async (room) => {
        if (room.status !== "live") {
          room.viewerCount = 0;
          return;
        }
        try {
          room.viewerCount = await roomState.getViewerCount(room.id);
        } catch {
          room.viewerCount = 0;
        }
      }),
    );

    return rooms as unknown as Room[];
  },

  async createRoom(input: CreateRoomInput): Promise<Room> {
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        title: input.title,
        host_id: input.host_id,
        livekit_room_name: input.livekit_room_name,
        category: normalizeCategory(input.category),
        cover: input.cover ?? null,
        description: normalizeTagline(input.description),
        max_guest_slots: input.max_guest_slots ?? 3,
        media_type: input.media_type ?? "video",
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

    // If this room was mid-PK-battle, the battle can't continue against a
    // room that no longer exists — tear it (and its Redis hot state) down
    // now rather than leaving it live for viewers to keep listening to.
    // Best-effort: never let a PK cleanup failure stop the room from ending.
    await pkService.endForRoom(roomId).catch(() => {});

    // Close every live SFU session and clear hot state (host/speakers/
    // stage/listener presence) now, instead of waiting for the reaper.
    await roomMediaService.shutdownRoom(roomId).catch(() => {});

    return data;
  },

  /**
   * System-initiated end, used when the host's 60s reconnect grace period
   * expires with no reconnect (see room-media.service.ts's host-grace
   * check) — there is no authenticated host request driving this, so it
   * skips endRoom()'s host-identity check. Best-effort and idempotent:
   * the `.eq("status", "live")` guard means calling this on an
   * already-ended room is a silent no-op rather than an error, since two
   * concurrent state reads could both notice the same expired host.
   */
  async forceEndRoom(roomId: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from("rooms")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .eq("status", "live")
      .select()
      .maybeSingle();

    if (error || !data) return null;

    await pkService.endForRoom(roomId).catch(() => {});

    await roomMediaService.shutdownRoom(roomId).catch(() => {});

    return data;
  },
};