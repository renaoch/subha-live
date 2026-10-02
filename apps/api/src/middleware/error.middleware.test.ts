import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request } from "express";
import { AppError } from "../errors/app-error";
import { CloudflareRealtimeError } from "../lib/media/cloudflare/cloudflare.errors";
import { errorMiddleware } from "./error.middleware";

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

interface FakeRes {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

function run(error: unknown, req: Partial<Request> = {}) {
  const res = fakeRes();
  errorMiddleware(
    error,
    req as Request,
    res as never,
    (() => {}) as NextFunction,
  );
  return res;
}

function bodyOf(res: FakeRes) {
  return (res.body as { error: { code?: string; message?: string; details?: unknown } }).error;
}

describe("error middleware redaction", () => {
  it("returns `details` for 4xx validation errors", () => {
    const res = run(
      new AppError(400, "Invalid payload", {
        code: "INVALID_PAYLOAD",
        details: { amount: ["must be positive"] },
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res).code).toBe("INVALID_PAYLOAD");
    expect(bodyOf(res).details).toEqual({ amount: ["must be positive"] });
  });

  it("drops `details` for 5xx errors so raw DB messages never leak", () => {
    const res = run(
      new AppError(500, "Failed", {
        code: "X_FAILED",
        details: "relation \"secret_table\" does not exist (SQLSTATE 42P01)",
      }),
    );
    expect(res.statusCode).toBe(500);
    expect(bodyOf(res).details).toBeUndefined();
    expect(bodyOf(res).message).toBe("Failed");
  });

  it("never leaks a Cloudflare provider response body", () => {
    const res = run(
      new CloudflareRealtimeError("Media provider failed", {
        statusCode: 502,
        responseBody: { sdp: "v=0...SECRET-SDP...", token: "secret" },
      }),
    );
    expect(res.statusCode).toBe(502);
    expect(bodyOf(res).code).toBe("MEDIA_PROVIDER_ERROR");
    expect(bodyOf(res).details).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("SECRET-SDP");
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("returns a generic message for unexpected (non-AppError) errors", () => {
    const res = run(new Error("connect ECONNREFUSED 127.0.0.1:5432"));
    expect(res.statusCode).toBe(500);
    expect(bodyOf(res).code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(res.body)).not.toContain("5432");
  });
});
