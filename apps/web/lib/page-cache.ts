// Tiny stale-while-revalidate cache for the pages reachable from Profile → Me.
//
// The profile menu calls `warmProfilePages()` as soon as it mounts, so by the
// time the user taps Level / Tasks / Agency / Trading the data is already in
// memory. Pages read `peek()` for their initial state (no skeleton, no wait)
// and call `load()` to silently refresh in the background.

import { levelsApi } from "@/lib/api/levels";
import { charismaApi } from "@/lib/api/charisma";
import { tasksApi } from "@/lib/api/tasks";
import { agencyApi } from "@/lib/api/agency";
import { tradingApi } from "@/lib/api/trading";

const store = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function peek<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function put<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Fetch + cache. Concurrent calls for the same key share one request. */
export function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = fetcher()
    .then((value) => {
      store.set(key, value);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

export const KEYS = {
  tasks: "tasks",
  level: "level",
  agency: "agency",
  trading: "trading",
} as const;

export const fetchers = {
  tasks: () => tasksApi.list(),
  level: () =>
    Promise.all([
      levelsApi.me(),
      levelsApi.rewards(),
      levelsApi.history(),
      charismaApi.me(),
    ]),
  agency: () => Promise.all([agencyApi.myAgency(), agencyApi.list()]),
  trading: () =>
    Promise.all([tradingApi.overview(), tradingApi.transactions(20, 0)]),
};

let warmed = 0;

/** Fire-and-forget: preload every destination's data. Errors are ignored. */
export function warmProfilePages(): void {
  // Don't hammer the API if the user keeps bouncing between tabs.
  if (Date.now() - warmed < 10_000) return;
  warmed = Date.now();

  void load(KEYS.tasks, fetchers.tasks).catch(() => {});
  void load(KEYS.level, fetchers.level).catch(() => {});
  void load(KEYS.agency, fetchers.agency).catch(() => {});
  void load(KEYS.trading, fetchers.trading).catch(() => {});
}