import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const rpc = vi.fn(async () => rpcResult);
let profileRow: { id: string; is_admin: boolean } | null = { id: "target", is_admin: false };

vi.mock("../../lib/redis", () => ({
  cacheGet: vi.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
  cacheSet: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
  cacheDel: vi.fn(async (k: string) => void store.delete(k)),
}));
vi.mock("../../lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (...a: unknown[]) => (rpc as any)(...a),
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: table === "profiles" ? profileRow : null, error: null }),
        update: () => chain,
        is: () => chain,
        in: () => chain,
        insert: () => chain,
        single: async () => ({
          data: { id: "ban-1", reason: "r", is_permanent: true, expires_at: null, created_at: new Date().toISOString() },
          error: null,
        }),
        then: (res: (v: unknown) => void) => res({ data: [], error: null }),
      };
      return chain;
    },
  },
}));

import { assertNotBanned, banService, getActiveBan } from "./ban.service";

const row = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  reason: "Spam",
  is_permanent: false,
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  store.clear();
  rpc.mockClear();
  rpcResult = { data: [], error: null };
  profileRow = { id: "target", is_admin: false };
});

describe("getActiveBan", () => {
  it("returns null for a user with no ban", async () => {
    expect(await getActiveBan("u1")).toBeNull();
  });

  it("returns the ban details for a temporary ban", async () => {
    rpcResult = { data: [row()], error: null };
    const ban = await getActiveBan("u1");
    expect(ban).toMatchObject({ permanent: false, reason: "Spam" });
    expect(ban?.until).toBeTruthy();
  });

  it("returns a permanent ban with no end date", async () => {
    rpcResult = { data: [row({ is_permanent: true, expires_at: null })], error: null };
    expect(await getActiveBan("u1")).toMatchObject({ permanent: true, until: null });
  });

  it("serves repeat checks from the cache (no DB hit per request)", async () => {
    rpcResult = { data: [row()], error: null };
    await getActiveBan("u1");
    await getActiveBan("u1");
    await getActiveBan("u1");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("a cached temporary ban lifts by itself once its time has passed", async () => {
    store.set("ban:u1", { id: "b", reason: "x", permanent: false, until: new Date(Date.now() - 1000).toISOString(), bannedAt: "" });
    expect(await getActiveBan("u1")).toBeNull();
  });

  it("fails open (and does not throw) if the lookup itself errors", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await getActiveBan("u1")).toBeNull();
  });
});

describe("assertNotBanned", () => {
  it("passes for a clean account", async () => {
    await expect(assertNotBanned("u1")).resolves.toBeUndefined();
  });

  it("throws 403 ACCOUNT_BANNED carrying the ban details", async () => {
    rpcResult = { data: [row({ is_permanent: true, expires_at: null })], error: null };
    await expect(assertNotBanned("u1")).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_BANNED",
      details: { permanent: true, reason: "Spam" },
    });
  });
});

describe("banService.ban guards", () => {
  it("refuses to let an admin ban themselves", async () => {
    await expect(banService.ban("a1", "a1", { type: "permanent", reason: "x y z" })).rejects.toMatchObject({
      code: "CANNOT_BAN_SELF",
    });
  });

  it("refuses to ban another admin", async () => {
    profileRow = { id: "target", is_admin: true };
    await expect(banService.ban("a1", "target", { type: "permanent", reason: "x y z" })).rejects.toMatchObject({
      code: "CANNOT_BAN_ADMIN",
    });
  });

  it("clears the cached ban state so the ban applies immediately", async () => {
    store.set("ban:target", { none: true });
    await banService.ban("a1", "target", { type: "permanent", reason: "Abuse" });
    expect(store.has("ban:target")).toBe(false);
  });
});
