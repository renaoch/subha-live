// File: apps/web/hooks/queries/use-pk.ts
//
// Party's "PK Battles" discovery surface. Reuses the existing pk API client
// (lib/api/pk.ts) — this only adds the list-all-active query used outside a
// specific room. Per-room live PK state still goes through `usePk`.

import { useQuery } from "@tanstack/react-query";
import { pkApi, type PkBattle, type PkHistoryEntry, type PkStats } from "@/lib/api/pk";

export const pkKeys = {
  all: ["pk"] as const,
  active: () => [...pkKeys.all, "active"] as const,
  history: (hostId: string) => [...pkKeys.all, "history", hostId] as const,
  last: (hostId: string) => [...pkKeys.all, "last", hostId] as const,
  stats: (hostId: string) => [...pkKeys.all, "stats", hostId] as const,
};

export function useActivePkBattles() {
  return useQuery<PkBattle[]>({
    queryKey: pkKeys.active(),
    queryFn: () => pkApi.listActive(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

/** PK history for a host's profile / PK records screen. */
export function usePkHistory(hostId: string | null | undefined, limit = 20) {
  return useQuery<PkHistoryEntry[]>({
    queryKey: pkKeys.history(hostId ?? ""),
    queryFn: () => pkApi.history(hostId as string, limit),
    enabled: !!hostId,
  });
}

/** Most recent finished PK for a host — the in-room "Last PK" card.
 * `refetchOnMount` so it picks up a battle that just finished in this
 * session without waiting for a stale cache to expire. */
export function useLastPk(hostId: string | null | undefined) {
  return useQuery<PkHistoryEntry | null>({
    queryKey: pkKeys.last(hostId ?? ""),
    queryFn: () => pkApi.last(hostId as string),
    enabled: !!hostId,
    refetchOnMount: "always",
  });
}

export function usePkStats(hostId: string | null | undefined) {
  return useQuery<PkStats>({
    queryKey: pkKeys.stats(hostId ?? ""),
    queryFn: () => pkApi.stats(hostId as string),
    enabled: !!hostId,
  });
}
