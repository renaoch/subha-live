import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { getOrSetCache, cacheDel } from "../../lib/redis";
import type { CreateChallengeInput, UpdateChallengeInput } from "./challenge.schema";

interface ChallengeRow {
  id: string;
  title: string;
  subtitle: string;
  country: string | null;
  reward_text: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  subtitle: string;
  country: string | null;
  rewardText: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface ChallengeStanding {
  rank: number;
  hostId: string;
  name: string;
  avatar: string | null;
  countryFlag: string | null;
  totalDiamonds: number;
}

export interface RoomChallenge {
  challenge: Challenge;
  /** Server clock, so the client countdown is immune to a wrong device clock. */
  serverNow: string;
  top: ChallengeStanding[];
  hostStanding: ChallengeStanding | null;
}

// Table was added after the last `supabase gen types` run (same convention as
// gift_catalog / host_earnings elsewhere in the API).
const challengesTable = () => supabase.from("regional_challenges" as any) as any;

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    country: row.country,
    rewardText: row.reward_text,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
  };
}

async function standings(
  challengeId: string,
  limit: number,
  hostId: string | null,
): Promise<ChallengeStanding[]> {
  const { data, error } = await supabase.rpc("regional_challenge_standings" as any, {
    p_challenge_id: challengeId,
    p_limit: limit,
    p_host_id: hostId,
  });
  if (error) {
    throw new AppError(500, "Failed to load challenge standings", {
      code: "CHALLENGE_STANDINGS_FAILED",
      details: error.message,
    });
  }
  return ((data ?? []) as any[]).map((r) => ({
    rank: Number(r.rank),
    hostId: r.host_id,
    name: r.name,
    avatar: r.avatar ?? null,
    countryFlag: r.country_flag ?? null,
    totalDiamonds: Number(r.total_diamonds),
  }));
}

async function loadForRoom(roomId: string): Promise<RoomChallenge | null> {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("host_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) {
    throw new AppError(500, "Failed to load room", { code: "ROOM_LOOKUP_FAILED", details: roomError.message });
  }
  if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });

  const hostId = room.host_id as string;
  const { data: host } = await supabase.from("profiles").select("country").eq("id", hostId).maybeSingle();
  const country = (host?.country as string | null) ?? null;
  const nowIso = new Date().toISOString();

  let query = challengesTable()
    .select("*")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  query = country ? query.or(`country.is.null,country.eq.${country.replace(/[,()]/g, "")}`) : query.is("country", null);

  const { data: rows, error } = await query;
  if (error) {
    throw new AppError(500, "Failed to load challenge", { code: "CHALLENGE_LOAD_FAILED", details: error.message });
  }
  if (!rows || rows.length === 0) return null;

  // A challenge for the host's own region beats a global one; then soonest to end.
  const sorted = [...(rows as ChallengeRow[])].sort((a, b) => {
    const aSpecific = a.country ? 0 : 1;
    const bSpecific = b.country ? 0 : 1;
    return aSpecific - bSpecific || a.ends_at.localeCompare(b.ends_at);
  });
  const challenge = sorted[0];

  const all = await standings(challenge.id, 5, hostId);
  const top = all.filter((s) => s.rank <= 5);
  const hostStanding = all.find((s) => s.hostId === hostId) ?? null;

  return { challenge: toChallenge(challenge), serverNow: nowIso, top, hostStanding };
}

export const challengeService = {
  /** Cached 10s: every viewer's header polls this. */
  async getForRoom(roomId: string): Promise<RoomChallenge | null> {
    const cached = await getOrSetCache<RoomChallenge | { none: true }>(
      `room:challenge:${roomId}`,
      10,
      async () => (await loadForRoom(roomId)) ?? { none: true },
    );
    if ("none" in cached) return null;
    return { ...cached, serverNow: new Date().toISOString() };
  },

  async leaderboard(challengeId: string, limit: number, viewerHostId: string | null) {
    const { data, error } = await challengesTable().select("*").eq("id", challengeId).maybeSingle();
    if (error) {
      throw new AppError(500, "Failed to load challenge", { code: "CHALLENGE_LOAD_FAILED", details: error.message });
    }
    if (!data) throw new AppError(404, "Challenge not found", { code: "CHALLENGE_NOT_FOUND" });
    const list = await getOrSetCache<ChallengeStanding[]>(
      `challenge:board:${challengeId}:${limit}:${viewerHostId ?? "-"}`,
      10,
      () => standings(challengeId, limit, viewerHostId),
    );
    return { challenge: toChallenge(data as ChallengeRow), standings: list, serverNow: new Date().toISOString() };
  },

  // ---- Admin ----
  async list(): Promise<Challenge[]> {
    const { data, error } = await challengesTable()
      .select("*")
      .order("ends_at", { ascending: false })
      .limit(100);
    if (error) {
      throw new AppError(500, "Failed to list challenges", { code: "CHALLENGE_LIST_FAILED", details: error.message });
    }
    return ((data ?? []) as ChallengeRow[]).map(toChallenge);
  },

  async create(adminId: string, input: CreateChallengeInput): Promise<Challenge> {
    const { data, error } = await challengesTable()
      .insert({
        title: input.title,
        subtitle: input.subtitle,
        country: input.country ?? null,
        reward_text: input.rewardText ?? null,
        starts_at: input.startsAt.toISOString(),
        ends_at: input.endsAt.toISOString(),
        created_by: adminId,
      })
      .select("*")
      .single();
    if (error) {
      throw new AppError(500, "Failed to create challenge", { code: "CHALLENGE_CREATE_FAILED", details: error.message });
    }
    return toChallenge(data as ChallengeRow);
  },

  async update(id: string, input: UpdateChallengeInput): Promise<Challenge> {
    const patch: Record<string, unknown> = {};
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.endsAt) patch.ends_at = input.endsAt.toISOString();
    if (input.title !== undefined) patch.title = input.title;
    if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
    if (input.rewardText !== undefined) patch.reward_text = input.rewardText;
    const { data, error } = await challengesTable().update(patch).eq("id", id).select("*").maybeSingle();
    if (error) {
      throw new AppError(500, "Failed to update challenge", { code: "CHALLENGE_UPDATE_FAILED", details: error.message });
    }
    if (!data) throw new AppError(404, "Challenge not found", { code: "CHALLENGE_NOT_FOUND" });
    return toChallenge(data as ChallengeRow);
  },
};

export { cacheDel };
