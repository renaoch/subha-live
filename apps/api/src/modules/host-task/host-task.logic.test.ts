import { describe, expect, it } from "vitest";
import {
  computeTaskPercent,
  deriveViewerState,
  isNewUser,
  isTaskExpired,
  isTaskNotStarted,
  meetsTaskTarget,
  remainingMs,
  resolveEligibility,
} from "./host-task.logic";

const NOW = new Date("2026-08-29T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

describe("isTaskExpired", () => {
  it("is false when there is no expiry", () => {
    expect(isTaskExpired(null, NOW)).toBe(false);
  });

  it("is false before expiry", () => {
    expect(isTaskExpired(new Date(NOW + 1000).toISOString(), NOW)).toBe(false);
  });

  it("is true at exactly the expiry boundary", () => {
    expect(isTaskExpired(new Date(NOW).toISOString(), NOW)).toBe(true);
  });

  it("is true after expiry", () => {
    expect(isTaskExpired(new Date(NOW - 1).toISOString(), NOW)).toBe(true);
  });
});

describe("isTaskNotStarted", () => {
  it("is false with no start time", () => {
    expect(isTaskNotStarted(null, NOW)).toBe(false);
  });

  it("is true when starts_at is in the future", () => {
    expect(isTaskNotStarted(new Date(NOW + 1000).toISOString(), NOW)).toBe(true);
  });

  it("is false once started", () => {
    expect(isTaskNotStarted(new Date(NOW - 1000).toISOString(), NOW)).toBe(false);
  });
});

describe("isNewUser", () => {
  it("is true within the window", () => {
    expect(isNewUser(new Date(NOW - 3 * DAY).toISOString(), 7, NOW)).toBe(true);
  });

  it("is false beyond the window", () => {
    expect(isNewUser(new Date(NOW - 8 * DAY).toISOString(), 7, NOW)).toBe(false);
  });

  it("is false for a missing created_at", () => {
    expect(isNewUser(null, 7, NOW)).toBe(false);
  });
});

describe("resolveEligibility", () => {
  const recent = new Date(NOW - 2 * DAY).toISOString();
  const old = new Date(NOW - 30 * DAY).toISOString();

  it("lets everyone through for audience 'all'", () => {
    expect(resolveEligibility("all", old, 7, NOW)).toBe(true);
  });

  it("accepts an eligible new user", () => {
    expect(resolveEligibility("new_users", recent, 7, NOW)).toBe(true);
  });

  it("rejects an ineligible new user (account too old)", () => {
    expect(resolveEligibility("new_users", old, 7, NOW)).toBe(false);
  });

  it("rejects a new user with no created_at", () => {
    expect(resolveEligibility("new_users", null, 7, NOW)).toBe(false);
  });

  it("accepts an eligible existing user", () => {
    expect(resolveEligibility("existing_users", old, 7, NOW)).toBe(true);
  });

  it("rejects an ineligible existing user (still in new window)", () => {
    expect(resolveEligibility("existing_users", recent, 7, NOW)).toBe(false);
  });
});

describe("computeTaskPercent", () => {
  it("is 0 when no targets are configured", () => {
    expect(computeTaskPercent(null, null, 5, 5)).toBe(0);
  });

  it("computes a straight hours percent", () => {
    expect(computeTaskPercent(5, null, 2.5, 0)).toBe(50);
  });

  it("clamps at 100", () => {
    expect(computeTaskPercent(5, null, 20, 0)).toBe(100);
  });

  it("uses the minimum percent when both targets are set", () => {
    // hours 100% but coins 25% -> 25%
    expect(computeTaskPercent(5, 1000, 5, 250)).toBe(25);
  });
});

describe("meetsTaskTarget", () => {
  it("is true when every configured target is met", () => {
    expect(meetsTaskTarget(5, 1000, 5, 1000)).toBe(true);
  });

  it("is false when hours fall short", () => {
    expect(meetsTaskTarget(5, null, 4.9, 0)).toBe(false);
  });

  it("is false when coins fall short", () => {
    expect(meetsTaskTarget(null, 1000, 0, 999)).toBe(false);
  });

  it("is false when one of two targets falls short", () => {
    expect(meetsTaskTarget(5, 1000, 5, 999)).toBe(false);
  });
});

describe("deriveViewerState", () => {
  it("reports claimed from the stored status", () => {
    expect(deriveViewerState("claimed", 5, 0)).toBe("claimed");
  });

  it("reports completed from the stored status", () => {
    expect(deriveViewerState("completed", 5, 0)).toBe("completed");
  });

  it("reports in_progress only after some progress", () => {
    expect(deriveViewerState("in_progress", 1, 0)).toBe("in_progress");
  });

  it("reports active when in_progress but zero progress", () => {
    expect(deriveViewerState("in_progress", 0, 0)).toBe("active");
  });

  it("reports active when no progress row exists", () => {
    expect(deriveViewerState(null, 0, 0)).toBe("active");
  });
});

describe("remainingMs", () => {
  it("is null without an expiry", () => {
    expect(remainingMs(null, NOW)).toBeNull();
  });

  it("computes a positive remainder", () => {
    expect(remainingMs(new Date(NOW + 10_000).toISOString(), NOW)).toBe(10_000);
  });

  it("clamps to zero once expired", () => {
    expect(remainingMs(new Date(NOW - 10_000).toISOString(), NOW)).toBe(0);
  });
});
