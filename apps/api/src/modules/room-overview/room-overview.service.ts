import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { getOrSetCache } from "../../lib/redis";
import { getHostContributors } from "../financial/financial.service";

export interface RoomOverview {
  roomId: string;
  host: {
    id: string;
    publicId: string | null;
    isVerified: boolean;
  };
  /** Top 3 gift senders to this host today — the avatars in the header. */
  topContributors: Array<{
    rank: number;
    userId: string;
    name: string;
    avatar: string | null;
    totalCoins: number;
  }>;
  /** Host's rank among all hosts by diamonds earned today ("Top N" pill). */
  hostRank: { rank: number; totalDiamonds: number; period: "daily" } | null;
}

// Short TTL: this is polled by every viewer in a room, so it must be served
// from cache. Staleness of a few seconds is invisible for a leaderboard.
const OVERVIEW_TTL_SECONDS = 10;

async function loadOverview(roomId: string): Promise<RoomOverview> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to load room", {
      code: "ROOM_OVERVIEW_FAILED",
      details: error.message,
    });
  }
  if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });

  const hostId = room.host_id as string;

  const [profileRes, contributors, rankRes] = await Promise.all([
    supabase.from("profiles").select("public_id, is_verified").eq("id", hostId).maybeSingle(),
    getHostContributors(hostId, "daily", 3),
    supabase.rpc("host_rank_for_period" as any, { p_host_id: hostId, p_period: "daily" }),
  ]);

  const rankRow = Array.isArray(rankRes.data) ? rankRes.data[0] : rankRes.data;

  return {
    roomId,
    host: {
      id: hostId,
      publicId: (profileRes.data as any)?.public_id ?? null,
      isVerified: Boolean((profileRes.data as any)?.is_verified),
    },
    topContributors: contributors.map((c) => ({
      rank: c.rank,
      userId: c.userId,
      name: c.name,
      avatar: c.avatar,
      totalCoins: c.totalCoins,
    })),
    hostRank:
      rankRow && Number(rankRow.total_diamonds) > 0
        ? { rank: Number(rankRow.rank), totalDiamonds: Number(rankRow.total_diamonds), period: "daily" }
        : null,
  };
}

export const roomOverviewService = {
  getOverview(roomId: string): Promise<RoomOverview> {
    return getOrSetCache(`room:overview:${roomId}`, OVERVIEW_TTL_SECONDS, () => loadOverview(roomId));
  },
};
