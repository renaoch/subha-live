import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { assertIsPlatformAdmin } from "../financial/financial.service";

export type UserFilter = "all" | "banned" | "admins" | "verified" | "vip";

export interface BanInfo {
  id: string;
  reason: string;
  permanent: boolean;
  until: string | null;
  bannedAt: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  handle: string;
  publicId: string | null;
  avatar: string | null;
  country: string | null;
  countryFlag: string | null;
  gender: string | null;
  role: string | null;
  isAdmin: boolean;
  isVerified: boolean;
  level: number;
  charismaLevel: number;
  vipLevel: number;
  svip: boolean;
  coins: number;
  diamonds: number;
  followers: number;
  following: number;
  createdAt: string;
  ban: BanInfo | null;
}

const LIST_COLUMNS =
  "id, name, handle, public_id, avatar, country, country_flag, gender, role, is_admin, is_verified, level, charisma_level, vip_level, svip, coins, diamonds, followers, following, created_at";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bansTable = () => supabase.from("user_bans" as any) as any;

function toRow(p: any, ban: BanInfo | null): AdminUserRow {
  return {
    id: p.id,
    name: p.name ?? "",
    handle: p.handle ?? "",
    publicId: p.public_id ?? null,
    avatar: p.avatar ?? null,
    country: p.country ?? null,
    countryFlag: p.country_flag ?? null,
    gender: p.gender ?? null,
    role: p.role ?? null,
    isAdmin: Boolean(p.is_admin),
    isVerified: Boolean(p.is_verified),
    level: p.level ?? 1,
    charismaLevel: p.charisma_level ?? 1,
    vipLevel: p.vip_level ?? 0,
    svip: Boolean(p.svip),
    coins: p.coins ?? 0,
    diamonds: p.diamonds ?? 0,
    followers: p.followers ?? 0,
    following: p.following ?? 0,
    createdAt: p.created_at,
    ban,
  };
}

function toBan(b: any): BanInfo {
  return {
    id: b.id,
    reason: b.reason,
    permanent: Boolean(b.is_permanent),
    until: b.expires_at ?? null,
    bannedAt: b.created_at,
  };
}

/** Active (un-revoked, un-expired) bans for a set of users, keyed by user id. */
async function activeBansFor(userIds: string[]): Promise<Map<string, BanInfo>> {
  const map = new Map<string, BanInfo>();
  if (userIds.length === 0) return map;
  const { data, error } = await bansTable()
    .select("id, user_id, reason, is_permanent, expires_at, created_at")
    .in("user_id", userIds)
    .is("revoked_at", null)
    .or(`is_permanent.eq.true,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: true });
  if (error) {
    throw new AppError(500, "Failed to load bans", { code: "BANS_LOAD_FAILED", details: error.message });
  }
  for (const b of (data ?? []) as any[]) map.set(b.user_id, toBan(b)); // newest wins
  return map;
}

export const adminUsersService = {
  async list(
    adminId: string,
    opts: { search?: string; filter: UserFilter; page: number; limit: number },
  ): Promise<{ users: AdminUserRow[]; total: number; page: number; limit: number }> {
    await assertIsPlatformAdmin(adminId);

    let query = supabase
      .from("profiles")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false });

    const q = (opts.search ?? "").replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
    if (q) {
      query = UUID_RE.test(q)
        ? query.eq("id", q)
        : query.or(`name.ilike.%${q}%,handle.ilike.%${q}%,public_id.eq.${q}`);
    }

    switch (opts.filter) {
      case "admins":
        query = query.eq("is_admin", true);
        break;
      case "verified":
        query = query.eq("is_verified", true);
        break;
      case "vip":
        query = query.or("svip.eq.true,vip_level.gt.0");
        break;
      case "banned": {
        const { data, error } = await bansTable()
          .select("user_id")
          .is("revoked_at", null)
          .or(`is_permanent.eq.true,expires_at.gt.${new Date().toISOString()}`)
          .limit(2000);
        if (error) {
          throw new AppError(500, "Failed to load bans", { code: "BANS_LOAD_FAILED", details: error.message });
        }
        const ids = [...new Set(((data ?? []) as any[]).map((r) => r.user_id as string))];
        if (ids.length === 0) return { users: [], total: 0, page: opts.page, limit: opts.limit };
        query = query.in("id", ids);
        break;
      }
      default:
        break;
    }

    const from = (opts.page - 1) * opts.limit;
    const { data, count, error } = await query.range(from, from + opts.limit - 1);
    if (error) {
      throw new AppError(500, "Failed to load users", { code: "USERS_LOAD_FAILED", details: error.message });
    }
    const rows = (data ?? []) as any[];
    const bans = await activeBansFor(rows.map((r) => r.id));

    return {
      users: rows.map((r) => toRow(r, bans.get(r.id) ?? null)),
      total: count ?? rows.length,
      page: opts.page,
      limit: opts.limit,
    };
  },

  async detail(adminId: string, userId: string) {
    await assertIsPlatformAdmin(adminId);

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      throw new AppError(500, "Failed to load user", { code: "USER_LOAD_FAILED", details: error.message });
    }
    if (!profile) throw new AppError(404, "User not found", { code: "USER_NOT_FOUND" });

    const [authRes, statsRes, historyRes, agencyRes] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase.rpc("admin_user_stats" as any, { p_user_id: userId }),
      bansTable()
        .select("id, reason, is_permanent, expires_at, created_at, banned_by, revoked_at, revoked_by, revoke_note")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("agency_hosts").select("agency_id, status, joined_at").eq("host_id", userId).limit(5),
    ]);

    const authUser = authRes.data?.user;
    const stats = (Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data) as any;

    const history = (historyRes.data ?? []) as any[];
    const actorIds = [...new Set(history.flatMap((h) => [h.banned_by, h.revoked_by]).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await supabase.from("profiles").select("id, name").in("id", actorIds)
      : { data: [] as Array<{ id: string; name: string | null }> };
    const actorName = new Map((actors.data ?? []).map((a: any) => [a.id, a.name as string | null]));

    const now = Date.now();
    const banHistory = history.map((h) => ({
      ...toBan(h),
      bannedBy: h.banned_by ? (actorName.get(h.banned_by) ?? null) : null,
      revokedAt: h.revoked_at ?? null,
      revokedBy: h.revoked_by ? (actorName.get(h.revoked_by) ?? null) : null,
      revokeNote: h.revoke_note ?? null,
      status: h.revoked_at
        ? ("lifted" as const)
        : h.is_permanent || new Date(h.expires_at).getTime() > now
          ? ("active" as const)
          : ("expired" as const),
    }));
    const activeBan = banHistory.find((b) => b.status === "active") ?? null;

    return {
      user: toRow(profile, activeBan),
      bio: (profile as any).bio ?? null,
      account: {
        email: authUser?.email ?? null,
        phone: authUser?.phone ?? null,
        emailConfirmed: Boolean(authUser?.email_confirmed_at),
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        provider: (authUser?.app_metadata as any)?.provider ?? null,
      },
      stats: {
        coinsSpent: Number(stats?.coins_spent ?? 0),
        giftsSent: Number(stats?.gifts_sent ?? 0),
        giftsReceived: Number(stats?.gifts_received ?? 0),
        diamondsEarned: Number(stats?.diamonds_earned ?? 0),
        roomsHosted: Number(stats?.rooms_hosted ?? 0),
      },
      agencies: ((agencyRes.data ?? []) as any[]).map((a) => ({
        agencyId: a.agency_id as string,
        status: a.status as string | null,
        joinedAt: a.joined_at as string | null,
      })),
      banHistory,
    };
  },
};
