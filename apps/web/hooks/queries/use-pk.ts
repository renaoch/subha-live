// File: apps/web/hooks/queries/use-pk.ts
//
// Party's "PK Battles" discovery surface. Reuses the existing pk API client
// (lib/api/pk.ts) — this only adds the list-all-active query used outside a
// specific room. Per-room live PK state still goes through `usePk`.

import { useQuery } from "@tanstack/react-query";
import { pkApi, type PkBattle } from "@/lib/api/pk";

export const pkKeys = {
  all: ["pk"] as const,
  active: () => [...pkKeys.all, "active"] as const,
};

export function useActivePkBattles() {
  return useQuery<PkBattle[]>({
    queryKey: pkKeys.active(),
    queryFn: () => pkApi.listActive(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
