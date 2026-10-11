import { apiFetch } from "@/lib/api/client";

export interface BanInfo {
  id: string;
  reason: string;
  permanent: boolean;
  until: string | null;
  bannedAt: string;
}

export interface AdminUser {
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

export type UserFilter = "all" | "banned" | "admins" | "verified" | "vip";

export interface BanHistoryItem extends BanInfo {
  bannedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeNote: string | null;
  status: "active" | "lifted" | "expired";
}

export interface AdminUserDetail {
  user: AdminUser;
  bio: string | null;
  account: {
    email: string | null;
    phone: string | null;
    emailConfirmed: boolean;
    lastSignInAt: string | null;
    provider: string | null;
  };
  stats: {
    coinsSpent: number;
    giftsSent: number;
    giftsReceived: number;
    diamondsEarned: number;
    roomsHosted: number;
  };
  agencies: Array<{ agencyId: string; status: string | null; joinedAt: string | null }>;
  banHistory: BanHistoryItem[];
}

export interface BanInput {
  type: "temporary" | "permanent";
  /** ISO time; required for temporary bans. */
  until?: string;
  reason: string;
}

type Env<T> = { success: boolean; data: T };

export const adminUsersApi = {
  list(params: { search?: string; filter?: UserFilter; page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.filter) q.set("filter", params.filter);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return apiFetch<Env<{ users: AdminUser[]; total: number; page: number; limit: number }>>(
      `/api/v1/admin/users?${q}`,
    ).then((r) => r.data);
  },
  detail(id: string) {
    return apiFetch<Env<AdminUserDetail>>(`/api/v1/admin/users/${id}`).then((r) => r.data);
  },
  ban(id: string, input: BanInput) {
    return apiFetch<Env<BanInfo>>(`/api/v1/admin/users/${id}/ban`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },
  unban(id: string, note?: string) {
    return apiFetch<Env<{ lifted: number }>>(`/api/v1/admin/users/${id}/unban`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }).then((r) => r.data);
  },
};
