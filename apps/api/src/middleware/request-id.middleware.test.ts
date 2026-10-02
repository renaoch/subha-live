import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requestIdMiddleware } from "./request-id.middleware";

function makeReq(headers: Record<string, string | undefined>) {
  const req = {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
  return req as unknown as Request;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
  };
  return { res: res as unknown as Response, headers };
}

function run(headers: Record<string, string | undefined> = {}) {
  const req = makeReq(headers);
  const { res, headers: setHeaders } = makeRes();
  let nextCalled = false;
  requestIdMiddleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);
  return { req, setHeaders, nextCalled };
}

describe("requestIdMiddleware", () => {
  it("reuses a valid incoming x-request-id", () => {
    const { req, setHeaders, nextCalled } = run({ "x-request-id": "abc-123-xyz" });
    expect(req.requestId).toBe("abc-123-xyz");
    expect(setHeaders["x-request-id"]).toBe("abc-123-xyz");
    expect(nextCalled).toBe(true);
  });

  it("regenerates an invalid incoming id (log-forging / control chars)", () => {
    const { req } = run({ "x-request-id": "bad id!\nlog-injected" });
    expect(req.requestId).toBeDefined();
    expect(req.requestId).not.toBe("bad id!\nlog-injected");
    expect(req.requestId).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("generates a new id when none is supplied", () => {
    const { req, setHeaders } = run({});
    expect(req.requestId).toBeDefined();
    expect(setHeaders["x-request-id"]).toBe(req.requestId);
  });
});
