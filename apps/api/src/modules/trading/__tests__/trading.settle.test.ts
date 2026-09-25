import { describe, expect, it } from "vitest";
import { InMemoryTradingSettle, InsufficientBalanceError } from "./in-memory-settle";

describe("trading settlement (concurrency + idempotency)", () => {
  it("does not double-spend when two payments race with the same balance", async () => {
    const settle = new InMemoryTradingSettle();
    settle.createAgency("agency-1", 100_000);
    settle.createHost("host-1", 0);

    const results = await Promise.allSettled([
      settle.payHost({ agencyId: "agency-1", hostId: "host-1", amount: 80_000, idempotencyKey: "a" }),
      settle.payHost({ agencyId: "agency-1", hostId: "host-1", amount: 80_000, idempotencyKey: "b" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(settle.getAgencyBalance("agency-1")).toBe(20_000);
    expect(settle.getHostCoins("host-1")).toBe(80_000);
    expect(settle.paymentCount("agency-1")).toBe(1);
  });

  it("is idempotent: a retry returns the original payment without paying twice", async () => {
    const settle = new InMemoryTradingSettle();
    settle.createAgency("agency-1", 100_000);
    settle.createHost("host-1", 0);

    const first = await settle.payHost({ agencyId: "agency-1", hostId: "host-1", amount: 40_000, idempotencyKey: "same" });
    const second = await settle.payHost({ agencyId: "agency-1", hostId: "host-1", amount: 40_000, idempotencyKey: "same" });

    expect(first.newBalance).toBe(60_000);
    expect(second.alreadyProcessed).toBe(true);
    expect(second.paymentId).toBe(first.paymentId);
    expect(settle.getAgencyBalance("agency-1")).toBe(60_000);
    expect(settle.getHostCoins("host-1")).toBe(40_000);
    expect(settle.paymentCount("agency-1")).toBe(1);
  });

  it("rejects a payment exceeding the balance", async () => {
    const settle = new InMemoryTradingSettle();
    settle.createAgency("agency-1", 500_000);
    settle.createHost("host-1", 0);

    await expect(
      settle.payHost({ agencyId: "agency-1", hostId: "host-1", amount: 600_000, idempotencyKey: "x" }),
    ).rejects.toThrow(InsufficientBalanceError);

    expect(settle.getAgencyBalance("agency-1")).toBe(500_000);
    expect(settle.getHostCoins("host-1")).toBe(0);
    expect(settle.paymentCount("agency-1")).toBe(0);
  });

  it("isolates agencies: paying from agency A never touches agency B's balance", async () => {
    const settle = new InMemoryTradingSettle();
    settle.createAgency("agency-a", 100_000);
    settle.createAgency("agency-b", 100_000);
    settle.createHost("host-1", 0);

    await settle.payHost({ agencyId: "agency-a", hostId: "host-1", amount: 30_000, idempotencyKey: "a1" });

    expect(settle.getAgencyBalance("agency-a")).toBe(70_000);
    expect(settle.getAgencyBalance("agency-b")).toBe(100_000);
    expect(settle.getHostCoins("host-1")).toBe(30_000);
  });

  it("fails when the host does not exist (no partial debit)", async () => {
    const settle = new InMemoryTradingSettle();
    settle.createAgency("agency-1", 100_000);

    await expect(
      settle.payHost({ agencyId: "agency-1", hostId: "missing-host", amount: 10_000, idempotencyKey: "y" }),
    ).rejects.toThrow("HOST_NOT_FOUND");

    expect(settle.getAgencyBalance("agency-1")).toBe(100_000);
    expect(settle.paymentCount("agency-1")).toBe(0);
  });

  it("allows two distinct payments after the first resolves", async () => {
    const settle = new InMemoryTradingSettle();
    settle.createAgency("agency-1", 100_000);
    settle.createHost("host-1", 0);
    settle.createHost("host-2", 0);

    await settle.payHost({ agencyId: "agency-1", hostId: "host-1", amount: 25_000, idempotencyKey: "p1" });
    const second = await settle.payHost({ agencyId: "agency-1", hostId: "host-2", amount: 25_000, idempotencyKey: "p2" });

    expect(second.newBalance).toBe(50_000);
    expect(settle.getAgencyBalance("agency-1")).toBe(50_000);
    expect(settle.paymentCount("agency-1")).toBe(2);
  });
});
