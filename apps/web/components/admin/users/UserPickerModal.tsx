"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { adminUsersApi, type AdminUser } from "@/lib/api/admin-users";
import { UserAvatar } from "@/components/admin/users/UserAvatar";
import { StatusBadge, UserBadges, num } from "@/components/admin/users/shared";

const PAGE = 20;

/** Browse EVERY user (avatar + details), search, and pick one. */
export function UserPickerModal({
  title = "Select a user",
  onPick,
  onClose,
}: {
  title?: string;
  onPick: (user: AdminUser) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      adminUsersApi
        .list({ search: query.trim() || undefined, page, limit: PAGE })
        .then((r) => {
          if (cancelled) return;
          setTotal(r.total);
          setUsers((prev) => (page === 1 ? r.users : [...prev, ...r.users]));
        })
        .catch(() => !cancelled && page === 1 && setUsers([]))
        .finally(() => !cancelled && setLoading(false));
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, page]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl border border-[#2A2238] bg-[#120e1b] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#2A2238] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#F3ECE0]">{title}</h3>
            <p className="text-[11.5px] text-[#9088A0]">{total.toLocaleString()} users</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#9088A0] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[#2A2238] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5E5570]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Search by name, @handle or ID"
              className="w-full rounded-xl border border-[#2A2238] bg-[#17131F] py-2.5 pl-10 pr-3.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onPick(u)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
            >
              <UserAvatar name={u.name} src={u.avatar} size={44} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold text-[#F3ECE0]">{u.name}</span>
                  <UserBadges isAdmin={u.isAdmin} isVerified={u.isVerified} svip={u.svip} vipLevel={u.vipLevel} />
                </span>
                <span className="block truncate text-[12px] text-[#9088A0]">
                  @{u.handle}
                  {u.publicId ? ` · ID ${u.publicId}` : ""}
                  {u.country ? ` · ${u.countryFlag ?? ""} ${u.country}` : ""}
                </span>
                <span className="block text-[11.5px] text-[#6f6683]">
                  Lv {u.level} · {num(u.followers)} followers · {num(u.diamonds)} 💎
                </span>
              </span>
              <StatusBadge ban={u.ban} />
            </button>
          ))}
          {loading && <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-[#9088A0]" />}
          {!loading && users.length === 0 && <p className="py-10 text-center text-[13px] text-[#9088A0]">No users found</p>}
          {!loading && users.length < total && (
            <button type="button" onClick={() => setPage((p) => p + 1)} className="mx-auto my-3 block rounded-full border border-[#2A2238] px-5 py-2 text-[12.5px] font-semibold text-[#C9C0D8] hover:text-white">
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
