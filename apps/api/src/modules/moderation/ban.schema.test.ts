import { describe, expect, it } from "vitest";
import { banUserSchema } from "./ban.schema";

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe("banUserSchema", () => {
  it("accepts a permanent ban with a reason", () => {
    expect(banUserSchema.safeParse({ type: "permanent", reason: "Repeated harassment" }).success).toBe(true);
  });

  it("accepts a temporary ban with a custom future date", () => {
    expect(banUserSchema.safeParse({ type: "temporary", until: inDays(3), reason: "Spam" }).success).toBe(true);
  });

  it("requires an end date for temporary bans", () => {
    const r = banUserSchema.safeParse({ type: "temporary", reason: "Spam" });
    expect(r.success).toBe(false);
  });

  it("rejects end dates in the past", () => {
    expect(banUserSchema.safeParse({ type: "temporary", until: inDays(-1), reason: "Spam" }).success).toBe(false);
  });

  it("rejects temporary bans longer than 10 years (use permanent)", () => {
    expect(banUserSchema.safeParse({ type: "temporary", until: inDays(365 * 11), reason: "Spam" }).success).toBe(false);
  });

  it("requires a real reason", () => {
    expect(banUserSchema.safeParse({ type: "permanent", reason: "  " }).success).toBe(false);
    expect(banUserSchema.safeParse({ type: "permanent", reason: "ab" }).success).toBe(false);
  });
});
