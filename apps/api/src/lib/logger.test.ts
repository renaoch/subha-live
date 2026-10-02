import { describe, expect, it, vi } from "vitest";
import { redact, logger } from "./logger";

describe("redact", () => {
  it("redacts known sensitive keys", () => {
    const out = redact({
      authorization: "Bearer secret-token",
      token: "abc",
      password: "hunter2",
      apiKey: "key-123",
      signed_url: "https://x/signed",
      name: "kept",
    }) as Record<string, unknown>;
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.token).toBe("[REDACTED]");
    expect(out.password).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.signed_url).toBe("[REDACTED]");
    expect(out.name).toBe("kept");
  });

  it("redacts nested sensitive keys", () => {
    const out = redact({ headers: { authorization: "Bearer x", "x-api-key": "k" } }) as Record<string, unknown>;
    const headers = out.headers as Record<string, unknown>;
    expect(headers.authorization).toBe("[REDACTED]");
    expect(headers["x-api-key"]).toBe("[REDACTED]");
  });

  it("redacts inside arrays and leaves non-sensitive values intact", () => {
    const out = redact({ list: [{ token: "a" }, { ok: 1 }] }) as Record<string, unknown>;
    expect((out.list as Array<Record<string, unknown>>)[0].token).toBe("[REDACTED]");
    expect((out.list as Array<Record<string, unknown>>)[1].ok).toBe(1);
  });

  it("passes primitives through unchanged", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });
});

describe("logger", () => {
  it("never throws, even on circular structures", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logger.error("boom", circular)).not.toThrow();
  });

  it("emits a JSON line to the console", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("test message", { authorization: "Bearer secret" });
    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0][0] as string;
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).not.toContain("Bearer secret");
    expect(line).toContain("[REDACTED]");
    spy.mockRestore();
  });
});
