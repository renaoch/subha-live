"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Users } from "lucide-react";

import { usersApi, type FollowListEntry } from "@/lib/api/users";

type Tab = "followers" | "following";

interface ConnectionsPageProps {
  initialTab: Tab;
}

export function ConnectionsPage({ initialTab }: ConnectionsPageProps) {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab) => {
    try {
      setLoading(true);
      setError(null);

      const me = await usersApi.me();
      setUserId(me.id);

      const list =
        activeTab === "followers"
          ? await usersApi.getFollowers(me.id)
          : await usersApi.getFollowing(me.id);

      setEntries(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load list.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  return (
    <main className="min-h-dvh bg-[#17131F] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div className="mx-auto flex max-w-md flex-col px-4 pb-10 pt-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2238] bg-[#1D1829]/80 text-[#9088A0] transition-all hover:border-[#CBA35C]/40 hover:text-[#CBA35C]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#F3ECE0]">
            Connections
          </h1>
        </div>

        <div className="mt-5 flex rounded-full border border-[#2A2238] bg-[#1D1829]/60 p-1">
          <TabButton
            label="Followers"
            active={tab === "followers"}
            onClick={() => setTab("followers")}
          />
          <TabButton
            label="Following"
            active={tab === "following"}
            onClick={() => setTab("following")}
          />
        </div>

        <div className="mt-5">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-[#2A2238] bg-[#1D1829]/40 p-3"
                >
                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#2A2238]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 animate-pulse rounded bg-[#2A2238]" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-[#2A2238]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="py-10 text-center text-sm text-red-300/70">
              {error}
            </p>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Users className="h-8 w-8 text-[#9088A0]/40" />
              <p className="text-sm text-[#9088A0]">
                {tab === "followers"
                  ? "No followers yet."
                  : "Not following anyone yet."}
              </p>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-[#2A2238] bg-[#1D1829]/40 p-3"
                >
                  {entry.avatar ? (
                    <img
                      src={entry.avatar}
                      alt={entry.name || "User"}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2A2238] text-sm font-black text-[#F3ECE0]">
                      {(entry.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-sm font-bold text-[#F3ECE0]">
                        {entry.name || "User"}
                      </p>
                      {entry.is_verified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-[#CBA35C] text-[#17131F]" />
                      )}
                    </div>
                    {entry.handle && (
                      <p className="truncate text-xs text-[#9088A0]">
                        @{entry.handle}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 rounded-full bg-[#2A2238] px-2 py-1 text-[10px] font-bold text-[#9088A0]">
                    Lv.{entry.level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
        active
          ? "bg-white text-black"
          : "text-[#9088A0] hover:text-[#F3ECE0]"
      }`}
    >
      {label}
    </button>
  );
}