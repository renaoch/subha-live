import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { Tables, TablesInsert } from "../../types/database.types";
import { mediaService } from "../media";
import { roomMediaService } from "./room-media.service";

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

  async listRooms(): Promise<
    Array<
      Room & {
        host: {
          id: string;
          name: string;
          handle: string;
          avatar: string | null;
          country_flag: string | null;
        } | null;
        viewerCount: number;
      }
    >
  > {
    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("*")
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new AppError(500, "Failed to list rooms", {
        code: "ROOM_LIST_FAILED",
        details: error.message,
      });
    }
const roomRows = (rooms ?? []) as Tables<"rooms">[];

const hostIds = [
  ...new Set(
    roomRows
      .map((room: Tables<"rooms">) => room.host_id)
      .filter((id): id is string => Boolean(id)),
  ),
];

    let profiles: Array<{
      id: string;
      name: string;
      handle: string;
      avatar: string | null;
      country_flag: string | null;
    }> = [];

    if (hostIds.length > 0) {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar, country_flag")
        .in("id", hostIds);

      if (profileError) {
        throw new AppError(500, "Failed to load room hosts", {
          code: "ROOM_HOSTS_FETCH_FAILED",
          details: profileError.message,
        });
      }

      profiles = data ?? [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

const result = await Promise.all(
  roomRows.map(
    async (room: Tables<"rooms">) => {
      const state =
        await roomMediaService.getState(
          room.id,
        );

      return {
        ...room,
        host:
          profileMap.get(
            room.host_id,
          ) ?? null,
        viewerCount:
          state.viewerCount,
      };
    },
  ),
);
    return result;
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
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
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

    return data;
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

    await mediaService.initializeRoom(roomId);
    await mediaService.incrementGeneration(roomId);
    await mediaService.setRoomStatus(roomId, "starting");

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

    await roomMediaService.shutdownRoom(roomId);

    return data;
  },
};