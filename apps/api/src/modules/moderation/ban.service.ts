import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { cacheDel, cacheGet, cacheSet } from "../../lib/redis";
import { logger } from "../../lib/logger";
import type { BanUserInput } from "./ban.schema";

/** What the client needs to render the ban screen. */
export interface ActiveBan {
  id: string;
  reason: string;
  permanent: boolean;
  /** ISO time the ban lifts; null for permanent bans. */
  until: string | null;
  bannedAt: string;
}

type Cached = ActiveBan | { none: true };

// Every authenticated request asks "is this user banned?", so the answer is
// cached. Short TTL as a backstop; ban/unban also delete the key, so a ban takes
// effect immediately on every API instance sharing Redis.
const CACHE_TTL_SECONDS = 15;
const cacheKey = (userId: string) => `ban:${userId}`;

function isStillActive(ban: ActiveBan, now = Date.now()): boolean {
  return ban.permanent || (ban.until !== null && new Date(ban.until).getTime() > now);
}

/**
 * The user's current ban, or null. Temporary bans lift by themselves: expiry is
 * checked against the clock on every read, so nothing has to run at expiry.
 *
 * If the lookup itself fails (e.g. the migration isn't applied yet) we fail
 * OPEN and log loudly — locking every user out of the whole API because of a
 * moderation-table hiccup is the worse outcome.
 */
export async function getActiveBan(userId: string): Promise<ActiveBan | null> {
  const cached = await cacheGet<Cached>(cacheKey(userId)).catch(() => null);
  if (cached) {
    if ("none" in cached) return null;
    return isStillActive(cached) ? cached : null;
  }

  const { data, error } = await supabase.rpc("active_user_ban" as any, { p_user_id: userId });
  if (error) {
    logger.error("ban lookup failed — failing open", { userId, error: error.message });
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; reason: string; is_permanent: boolean; expires_at: string | null; created_at: string }
    | undefined;

  if (!row) {
    await cacheSet(cacheKey(userId), { none: true }, CACHE_TTL_SECONDS).catch(() => {});
    return null;
  }
  const ban: ActiveBan = {
    id: row.id,
    reason: row.reason,
    permanent: Boolean(row.is_permanent),
    until: row.expires_at ?? null,
    bannedAt: row.created_at,
  };
  await cacheSet(cacheKey(userId), ban, CACHE_TTL_SECONDS).catch(() => {});
  return ban;
}

export function banMessage(ban: ActiveBan): string {
  return ban.permanent
    ? "Your account has been permanently banned."
    : "Your account is temporarily banned.";
}

/** Throws ACCOUNT_BANNED (403) with the ban details if the user is banned. */
export async function assertNotBanned(userId: string): Promise<void> {
  const ban = await getActiveBan(userId);
  if (ban) {
    throw new AppError(403, banMessage(ban), { code: "ACCOUNT_BANNED", details: ban });
  }
}

async function audit(
  actorId: string,
  action: string,
  userId: string,
  oldValue: unknown,
  newValue: unknown,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "user",
    entity_id: userId,
    old_value: oldValue as never,
    new_value: newValue as never,
  });
  if (error) logger.warn("ban audit log failed", { error: error.message });
}

export const banService = {
  async ban(adminId: string, userId: string, input: BanUserInput): Promise<ActiveBan> {
    if (adminId === userId) {
      throw new AppError(400, "You can't ban yourself", { code: "CANNOT_BAN_SELF" });
    }
    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) {
      throw new AppError(500, "Failed to look up user", { code: "USER_LOOKUP_FAILED", details: targetError.message });
    }
    if (!target) throw new AppError(404, "User not found", { code: "USER_NOT_FOUND" });
    if (target.is_admin) {
      throw new AppError(403, "Admins can't be banned", { code: "CANNOT_BAN_ADMIN" });
    }

    // One active ban at a time: a new ban supersedes the old one.
    const nowIso = new Date().toISOString();
    await (supabase.from("user_bans" as any) as any)
      .update({ revoked_at: nowIso, revoked_by: adminId, revoke_note: "Superseded by a new ban" })
      .eq("user_id", userId)
      .is("revoked_at", null);

    const permanent = input.type === "permanent";
    const { data, error } = await (supabase.from("user_bans" as any) as any)
      .insert({
        user_id: userId,
        banned_by: adminId,
        reason: input.reason,
        is_permanent: permanent,
        expires_at: permanent ? null : input.until!.toISOString(),
      })
      .select("id, reason, is_permanent, expires_at, created_at")
      .single();
    if (error) {
      throw new AppError(500, "Failed to ban user", { code: "BAN_FAILED", details: error.message });
    }

    // Effective immediately, on every API instance.
    await cacheDel(cacheKey(userId)).catch(() => {});

    // A banned host's live ends now.
    const { error: roomError } = await supabase
      .from("rooms")
      .update({ status: "ended", ended_at: nowIso } as never)
      .eq("host_id", userId)
      .in("status", ["created", "live"]);
    if (roomError) logger.warn("failed to end banned host's rooms", { userId, error: roomError.message });

    await audit(adminId, "user.ban", userId, null, {
      permanent,
      until: data.expires_at,
      reason: input.reason,
    });

    return {
      id: data.id,
      reason: data.reason,
      permanent: Boolean(data.is_permanent),
      until: data.expires_at ?? null,
      bannedAt: data.created_at,
    };
  },

  async unban(adminId: string, userId: string, note?: string): Promise<{ lifted: number }> {
    const { data, error } = await (supabase.from("user_bans" as any) as any)
      .update({ revoked_at: new Date().toISOString(), revoked_by: adminId, revoke_note: note ?? null })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id");
    if (error) {
      throw new AppError(500, "Failed to lift ban", { code: "UNBAN_FAILED", details: error.message });
    }
    await cacheDel(cacheKey(userId)).catch(() => {});
    const lifted = (data ?? []).length;
    if (lifted > 0) await audit(adminId, "user.unban", userId, { lifted }, { note: note ?? null });
    return { lifted };
  },
};
