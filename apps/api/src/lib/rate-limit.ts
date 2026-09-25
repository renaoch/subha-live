// File: apps/api/src/lib/rate-limit.ts
//
// Minimal Redis-backed fixed-window rate limiter. Used to protect the few
// economically-sensitive, high-frequency endpoints (e.g. the lucky spin) from
// excessive request volume. It is NOT a security boundary on its own — balance
// correctness/concurrency is enforced in Postgres — it exists to shed abuse and
// reduce Redis/DB pressure.
//
// Fail-safe: if Redis is unreachable the request is allowed through rather than
// blocking legitimate traffic (rate limiting must never be a worse outage than
// the one it's guarding against).

import type { NextFunction, Request, Response } from "express";
import { redis } from "./redis";

interface RateLimitOptions {
  /** Max requests allowed per window per key. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Suffix appended to the Redis key (e.g. "lucky:spin"). */
  namespace: string;
}

const DEFAULTS: Omit<RateLimitOptions, "namespace"> = {
  max: 20,
  windowSeconds: 10,
};

export function rateLimit(
  namespace: string,
  options: Partial<Omit<RateLimitOptions, "namespace">> = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const { max, windowSeconds } = { ...DEFAULTS, ...options };
  const windowMs = windowSeconds * 1000;
  const now = () => Math.floor(Date.now() / windowMs);

  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id ?? req.ip ?? "anonymous";
    const key = `rl:${namespace}:${userId}:${now()}`;

    let count = 0;
    try {
      count = Number(await redis.incr(key));
      if (count === 1) {
        // Set the window expiry on the first request in the window.
        await redis.expire(key, windowSeconds + 1);
      }
    } catch (error) {
      console.error(`[rate-limit] Redis error for ${namespace}:`, error);
      return next(); // fail open
    }

    if (count > max) {
      res.status(429).json({
        status: "error",
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait a moment and try again.",
        },
      });
      return;
    }

    next();
  };
}
