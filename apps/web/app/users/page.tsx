"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Coins, Gem, Loader2, Search, UsersRound } from "lucide-react";
import { adminUsersApi, type AdminUser, type UserFilter } from "@/lib/api/admin-users";
import { UserAvatar } from "@/components/admin/users/UserAvatar";
import { UserDetailDrawer } from "@/components/admin/users/UserDetailDrawer";
import { StatusBadge, UserBadges, fmtDay, num } from "@/components/admin/users/shared";

const LIMIT = 24;

const FILTERS: Array<{ id: UserFilter; label: string }> = [
  { id: "all", label: "All users" },
  { id: "banned", label: "Banned" },
  { id: "admins", label: "Admins" },
  { id: "verified", label: "Verified" },
  { id: "vip", label: "VIP / SVIP" },
];

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminUsersApi.list({ search: search || undefined, filter, page, limit: LIMIT });
      setUsers(r.users);
      setTotal(r.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CBA35C]/15 text-[#CBA35C]">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-[#F3ECE0]">Users</h2>
            <p className="text-[12px] text-[#9088A0]">{total.toLocaleString()} {filter === "all" ? "total" : "matching"}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5E5570]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, @handle, public ID or user ID"
            className="w-full rounded-xl border border-[#2A2238] bg-[#17131F] py-2.5 pl-10 pr-3.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              filter === f.id
                ? f.id === "banned"
                  ? "border-red-400/60 bg-red-500/15 text-red-300"
                  : "border-[#CBA35C] bg-[#CBA35C]/15 text-[#CBA35C]"
                : "border-[#2A2238] bg-[#17131F] text-[#9088A0] hover:text-[#F3ECE0]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-300">{error}</p>}

      <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${loading && users.length ? "opacity-60" : ""}`}>
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setOpenId(u.id)}
            className={`rounded-2xl border p-4 text-left transition hover:border-[#CBA35C]/40 hover:bg-white/[0.03] ${
              u.ban ? "border-red-400/30 bg-red-500/[0.04]" : "border-[#2A2238] bg-[#1D1829]/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar name={u.name} src={u.avatar} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-[14.5px] font-semibold text-[#F3ECE0]">{u.name}</p>
                  <UserBadges isAdmin={u.isAdmin} isVerified={u.isVerified} svip={u.svip} vipLevel={u.vipLevel} />
                </div>
                <p className="truncate text-[12px] text-[#9088A0]">
                  @{u.handle}
                  {u.publicId ? ` · ID ${u.publicId}` : ""}
                </p>
                <p className="truncate text-[11.5px] text-[#6f6683]">
                  {u.countryFlag} {u.country ?? "—"} · {u.role ?? "user"} · joined {fmtDay(u.createdAt)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusBadge ban={u.ban} />
              <span className="text-[11.5px] font-semibold text-[#C9C0D8]">Lv {u.level}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#2A2238] pt-3 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 text-[13px] font-semibold text-[#F3ECE0]">
                  <Coins className="h-3.5 w-3.5 text-amber-300" /> {num(u.coins)}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-[#6f6683]">Coins</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-[13px] font-semibold text-[#F3ECE0]">
                  <Gem className="h-3.5 w-3.5 text-fuchsia-300" /> {num(u.diamonds)}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-[#6f6683]">Diamonds</p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#F3ECE0]">{num(u.followers)}</p>
                <p className="text-[10px] uppercase tracking-wide text-[#6f6683]">Followers</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {loading && users.length === 0 && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#9088A0]" />
        </div>
      )}
      {!loading && !error && users.length === 0 && <p className="py-16 text-center text-sm font-bold text-white/40">No users found</p>}

      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2238] text-[#C9C0D8] disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[12.5px] text-[#9088A0]">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2238] text-[#C9C0D8] disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {openId && <UserDetailDrawer userId={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}
