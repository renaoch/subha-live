// Creator Studio — an aggregate, read-only dashboard for a host/creator. All
// figures come from the authoritative financial/durable tables (gifts,
// host_earnings, rooms, profiles). No client-computed balances.

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

const db = supabase as unknown as { from: (table: string) => any };

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export interface CreatorSession {
  id: string;
  title: string;
  status: string;
  mediaType: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface CreatorOverview {
  userId: string;
  level: number;
  charismaLevel: number;
  followers: number;
  isVerified: boolean;
  totalGiftsReceived: number;
  giftCoinValue: number;
  availableDiamonds: number;
  totalDiamondsEarned: number;
  totalSessions: number;
  liveSessions: number;
  recentSessions: CreatorSession[];
}

export const creatorStudioService = {
  async getOverview(userId: string): Promise<CreatorOverview> {
    const [
      profileRes,
      giftsRes,
      earningsRes,
      sessionsRes,
      liveRes,
      totalRes,
    ] = await Promise.all([
      db.from("profiles").select("level, charisma_level, followers, is_verified").eq("id", userId).maybeSingle(),
      db.from("gifts").select("value").eq("recipient_id", userId),
      db.from("host_earnings").select("diamonds, status").eq("host_id", userId),
      db.from("rooms")
        .select("id, title, status, media_type, started_at, ended_at, created_at")
        .eq("host_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      db.from("rooms").select("id").eq("host_id", userId).eq("status", "live"),
      db.from("rooms").select("id", { count: "exact", head: true }).eq("host_id", userId),
    ]);

    if (profileRes.error) {
      throw new AppError(500, "Failed to load creator profile", { code: "CREATOR_PROFILE_FAILED" });
    }
    const profile = (profileRes.data ?? {}) as Record<string, unknown>;

    const gifts = (giftsRes.data ?? []) as Array<{ value: number }>;
    const giftCoinValue = gifts.reduce((sum, g) => sum + toNumber(g.value), 0);

    const earnings = (earningsRes.data ?? []) as Array<{ diamonds: number; status: string }>;
    let availableDiamonds = 0;
    let totalDiamondsEarned = 0;
    for (const e of earnings) {
      const d = toNumber(e.diamonds);
      totalDiamondsEarned += d;
      if (e.status === "available") availableDiamonds += d;
    }

    const sessions = (sessionsRes.data ?? []) as Array<Record<string, unknown>>;
    const recentSessions: CreatorSession[] = sessions.map((s) => ({
      id: String(s.id),
      title: String(s.title),
      status: String(s.status),
      mediaType: String(s.media_type ?? "video"),
      startedAt: (s.started_at as string | null) ?? null,
      endedAt: (s.ended_at as string | null) ?? null,
      createdAt: String(s.created_at),
    }));

    return {
      userId,
      level: toNumber(profile.level),
      charismaLevel: toNumber(profile.charisma_level),
      followers: toNumber(profile.followers),
      isVerified: Boolean(profile.is_verified),
      totalGiftsReceived: gifts.length,
      giftCoinValue,
      availableDiamonds,
      totalDiamondsEarned,
      totalSessions: totalRes.count ?? 0,
      liveSessions: (liveRes.data ?? []).length,
      recentSessions,
    };
  },
};
