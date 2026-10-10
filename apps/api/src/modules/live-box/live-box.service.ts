import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

export interface LiveBoxStatus {
  /** false => the client hides the box entirely. */
  available: boolean;
  rewardCoins: number;
  intervalSeconds: number;
  dailyLimit: number;
  claimedToday: number;
  remainingToday: number;
  /** When the next box opens for THIS viewer in THIS room (null if not watching). */
  nextReadyAt: string | null;
  canClaim: boolean;
  serverNow: string;
}

export interface LiveBoxSettings {
  isEnabled: boolean;
  intervalSeconds: number;
  rewardCoins: number;
  dailyLimit: number;
}

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  LIVE_BOX_DISABLED: { status: 409, message: "The gift box is not available right now" },
  LIVE_BOX_NOT_ELIGIBLE: { status: 403, message: "Watch this live to earn gift boxes" },
  LIVE_BOX_LIMIT_REACHED: { status: 409, message: "You've opened all of today's gift boxes" },
  LIVE_BOX_NOT_READY: { status: 409, message: "Your gift box isn't ready yet" },
};

function first<T>(data: T[] | T | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export const liveBoxService = {
  async status(userId: string, roomId: string): Promise<LiveBoxStatus> {
    const { data, error } = await supabase.rpc("live_box_status" as any, {
      p_user_id: userId,
      p_room_id: roomId,
    });
    if (error) {
      throw new AppError(500, "Failed to load gift box", { code: "LIVE_BOX_STATUS_FAILED", details: error.message });
    }
    const row = first<any>(data);
    if (!row) throw new AppError(500, "Gift box state unavailable", { code: "LIVE_BOX_STATUS_FAILED" });

    const claimedToday = Number(row.claimed_today);
    const dailyLimit = Number(row.daily_limit);
    const remainingToday = Math.max(0, dailyLimit - claimedToday);
    const serverNow = new Date(row.server_now);
    const nextReadyAt = row.next_ready_at ? new Date(row.next_ready_at) : null;
    const available = Boolean(row.is_enabled) && Number(row.reward_coins) > 0 && Boolean(row.eligible);

    return {
      available,
      rewardCoins: Number(row.reward_coins),
      intervalSeconds: Number(row.interval_seconds),
      dailyLimit,
      claimedToday,
      remainingToday,
      nextReadyAt: nextReadyAt ? nextReadyAt.toISOString() : null,
      canClaim: available && remainingToday > 0 && !!nextReadyAt && nextReadyAt <= serverNow,
      serverNow: serverNow.toISOString(),
    };
  },

  async claim(userId: string, roomId: string) {
    const { data, error } = await supabase.rpc("fin_claim_live_box" as any, {
      p_user_id: userId,
      p_room_id: roomId,
    });
    if (error) {
      const code = Object.keys(ERROR_MAP).find((c) => error.message?.includes(c));
      if (code) {
        throw new AppError(ERROR_MAP[code].status, ERROR_MAP[code].message, { code });
      }
      console.error("[live-box] claim failed:", error.message);
      throw new AppError(500, "Failed to open gift box", { code: "LIVE_BOX_CLAIM_FAILED" });
    }
    const row = first<any>(data);
    if (!row) throw new AppError(500, "Gift box claim returned nothing", { code: "LIVE_BOX_CLAIM_FAILED" });
    return {
      rewardCoins: Number(row.reward_coins),
      newCoins: Number(row.new_coins),
      claimedToday: Number(row.claimed_today),
      dailyLimit: Number(row.daily_limit),
      remainingToday: Math.max(0, Number(row.daily_limit) - Number(row.claimed_today)),
      nextReadyAt: new Date(row.next_ready_at).toISOString(),
    };
  },

  // ---- Admin ----
  async getSettings(): Promise<LiveBoxSettings> {
    const { data, error } = await (supabase.from("live_box_settings" as any) as any)
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      throw new AppError(500, "Failed to load gift box settings", { code: "LIVE_BOX_SETTINGS_FAILED", details: error.message });
    }
    return {
      isEnabled: Boolean(data?.is_enabled),
      intervalSeconds: data?.interval_seconds ?? 300,
      rewardCoins: data?.reward_coins ?? 0,
      dailyLimit: data?.daily_limit ?? 12,
    };
  },

  async updateSettings(input: Partial<LiveBoxSettings>): Promise<LiveBoxSettings> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.isEnabled !== undefined) patch.is_enabled = input.isEnabled;
    if (input.intervalSeconds !== undefined) patch.interval_seconds = input.intervalSeconds;
    if (input.rewardCoins !== undefined) patch.reward_coins = input.rewardCoins;
    if (input.dailyLimit !== undefined) patch.daily_limit = input.dailyLimit;
    const { error } = await (supabase.from("live_box_settings" as any) as any).update(patch).eq("id", 1);
    if (error) {
      throw new AppError(500, "Failed to save gift box settings", { code: "LIVE_BOX_SETTINGS_FAILED", details: error.message });
    }
    return this.getSettings();
  },
};
