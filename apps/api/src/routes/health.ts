import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";

import { supabase } from "../lib/supabase";
import { redisHealth } from "../lib/redis";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Configuration                                                             */
/* -------------------------------------------------------------------------- */

const DB_TIMEOUT_MS = Number(
  process.env.HEALTH_DB_TIMEOUT_MS || 5000
);

const REDIS_TIMEOUT_MS = Number(
  process.env.HEALTH_REDIS_TIMEOUT_MS || 3000
);

const READY_TIMEOUT_MS = Number(
  process.env.HEALTH_READY_TIMEOUT_MS || 7000
);

/*
 * Prevent accidentally configuring nonsense values.
 */
const DB_TIMEOUT = clampTimeout(DB_TIMEOUT_MS, 1000, 30000);
const REDIS_TIMEOUT = clampTimeout(REDIS_TIMEOUT_MS, 500, 30000);
const READY_TIMEOUT = clampTimeout(READY_TIMEOUT_MS, 1000, 30000);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clampTimeout(
  value: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getRequestId(req: Request): string {
  const existing =
    req.header("x-request-id") ||
    req.header("x-correlation-id");

  return existing || randomUUID();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/*
 * Never expose internal infrastructure errors to the public.
 *
 * This prevents things like:
 *
 *   Redis URL
 *   Supabase details
 *   internal hostnames
 *   connection information
 *   provider-specific errors
 *
 * from leaking through the health endpoint.
 */
function publicHealthError(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("timeout")) {
    return "dependency timeout";
  }

  if (
    message.includes("econnrefused") ||
    message.includes("connection refused")
  ) {
    return "connection refused";
  }

  if (
    message.includes("enotfound") ||
    message.includes("getaddrinfo")
  ) {
    return "dependency unavailable";
  }

  if (
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "network error";
  }

  return "dependency unavailable";
}

/* -------------------------------------------------------------------------- */
/* Promise Timeout                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Prevents a health endpoint from hanging forever when an external
 * dependency never resolves.
 *
 * IMPORTANT:
 * This protects the HTTP request.
 * It does not necessarily cancel the underlying promise.
 *
 * The Redis/Supabase clients should still have their own network timeouts.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  dependency: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;

      reject(
        new Error(
          `${dependency} health check timed out after ${timeoutMs}ms`
        )
      );
    }, timeoutMs);

    /*
     * Prevent the timer from keeping Node alive unnecessarily.
     */
    timer.unref?.();

    promise.then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);

        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);

        reject(error);
      }
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Uptime                                                                     */
/* -------------------------------------------------------------------------- */

function formatUptime(seconds: number): string {
  let remaining = Math.max(0, seconds);

  const days = Math.floor(remaining / 86400);
  remaining %= 86400;

  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;

  const minutes = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  parts.push(`${secs}s`);

  return parts.join(" ");
}

/* -------------------------------------------------------------------------- */
/* GET /health                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Basic process health.
 *
 * IMPORTANT:
 * This endpoint intentionally does NOT touch:
 *
 * - Supabase
 * - Redis
 * - LiveKit
 * - external APIs
 * - DNS
 * - network
 *
 * It only tells Azure:
 *
 * "The Node process is alive and Express can answer requests."
 */
router.get("/", (_req: Request, res: Response) => {
  try {
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    return res.status(200).json({
      status: "ok",
      service: "api",
      server: "healthy",

      uptime: {
        seconds: Math.floor(uptime),
        human: formatUptime(uptime),
      },

      timestamp: new Date().toISOString(),

      runtime: {
        node: process.version,
        environment:
          process.env.NODE_ENV || "development",
      },

      memory: {
        rss: `${Math.round(
          memory.rss / 1024 / 1024
        )} MB`,

        heapUsed: `${Math.round(
          memory.heapUsed / 1024 / 1024
        )} MB`,

        heapTotal: `${Math.round(
          memory.heapTotal / 1024 / 1024
        )} MB`,
      },
    });
  } catch (error) {
    /*
     * This should basically never happen, but health endpoints
     * should fail gracefully even when something extremely weird
     * happens.
     */

    console.error("[health] unexpected error", error);

    return res.status(500).json({
      status: "error",
      service: "api",
      server: "unhealthy",
      timestamp: new Date().toISOString(),
    });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /health/db                                                            */
/* -------------------------------------------------------------------------- */

router.get(
  "/db",
  async (req: Request, res: Response) => {
    const startTime = performance.now();
    const requestId = getRequestId(req);

    try {
      const result = await withTimeout(
        supabase
          .from("profiles")
          .select("id")
          .limit(1),

        DB_TIMEOUT,
        "Supabase"
      );

      const responseTime = Math.round(
        performance.now() - startTime
      );

      if (result.error) {
        console.error(
          "[health/db] Supabase returned an error",
          {
            requestId,
            responseTime,
            error: result.error,
          }
        );

        return res.status(503).json({
          status: "error",
          service: "api",

          database: {
            status: "unhealthy",
            provider: "supabase",
            responseTime: `${responseTime}ms`,
          },

          timestamp: new Date().toISOString(),
          requestId,

          error: "database unavailable",
        });
      }

      return res.status(200).json({
        status: "ok",
        service: "api",

        database: {
          status: "healthy",
          provider: "supabase",
          responseTime: `${responseTime}ms`,
        },

        timestamp: new Date().toISOString(),
        requestId,
      });
    } catch (error) {
      const responseTime = Math.round(
        performance.now() - startTime
      );

      console.error(
        "[health/db] Supabase health check failed",
        {
          requestId,
          responseTime,
          error: getErrorMessage(error),
        }
      );

      return res.status(503).json({
        status: "error",
        service: "api",

        database: {
          status: "unhealthy",
          provider: "supabase",
          responseTime: `${responseTime}ms`,
        },

        timestamp: new Date().toISOString(),
        requestId,

        error: publicHealthError(error),
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* GET /health/redis                                                         */
/* -------------------------------------------------------------------------- */

router.get(
  "/redis",
  async (req: Request, res: Response) => {
    const startTime = performance.now();
    const requestId = getRequestId(req);

    try {
      /*
       * CRITICAL:
       *
       * Never directly await redisHealth().
       *
       * If Redis hangs, this endpoint must still respond.
       */
      await withTimeout(
        redisHealth(),
        REDIS_TIMEOUT,
        "Redis"
      );

      const responseTime = Math.round(
        performance.now() - startTime
      );

      return res.status(200).json({
        status: "ok",
        service: "api",

        redis: {
          status: "healthy",
          responseTime: `${responseTime}ms`,
        },

        timestamp: new Date().toISOString(),
        requestId,
      });
    } catch (error) {
      const responseTime = Math.round(
        performance.now() - startTime
      );

      console.error(
        "[health/redis] Redis health check failed",
        {
          requestId,
          responseTime,
          error: getErrorMessage(error),
        }
      );

      return res.status(503).json({
        status: "error",
        service: "api",

        redis: {
          status: "unhealthy",
          responseTime: `${responseTime}ms`,
        },

        timestamp: new Date().toISOString(),
        requestId,

        error: publicHealthError(error),
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* GET /health/ready                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Readiness semantics:
 *
 * Supabase:
 *   REQUIRED
 *
 * Redis:
 *   OPTIONAL
 *
 * Therefore:
 *
 * DB healthy + Redis healthy
 *       => 200 ready
 *
 * DB healthy + Redis unhealthy
 *       => 200 ready / Redis degraded
 *
 * DB unhealthy
 *       => 503 not_ready
 */
router.get(
  "/ready",
  async (req: Request, res: Response) => {
    const startTime = performance.now();
    const requestId = getRequestId(req);

    try {
      const checks = await withTimeout(
        Promise.allSettled([
          withTimeout(
            supabase
              .from("profiles")
              .select("id")
              .limit(1),

            DB_TIMEOUT,
            "Supabase"
          ),

          withTimeout(
            redisHealth(),
            REDIS_TIMEOUT,
            "Redis"
          ),
        ]),

        READY_TIMEOUT,
        "Readiness"
      );

      const [dbResult, redisResult] = checks;

      /* -------------------------------------------------------------------- */
      /* Database                                                              */
      /* -------------------------------------------------------------------- */

      const dbHealthy =
        dbResult.status === "fulfilled" &&
        !dbResult.value.error;

      /* -------------------------------------------------------------------- */
      /* Redis                                                                */
      /* -------------------------------------------------------------------- */

      const redisHealthy =
        redisResult.status === "fulfilled";

      const responseTime = Math.round(
        performance.now() - startTime
      );

      /* -------------------------------------------------------------------- */
      /* Logging                                                              */
      /* -------------------------------------------------------------------- */

      if (!dbHealthy) {
        console.error(
          "[health/ready] Database unhealthy",
          {
            requestId,
            responseTime,
            result: dbResult,
          }
        );
      }

      if (!redisHealthy) {
        console.warn(
          "[health/ready] Redis degraded",
          {
            requestId,
            responseTime,
            result: redisResult,
          }
        );
      }

      /* -------------------------------------------------------------------- */
      /* Response                                                             */
      /* -------------------------------------------------------------------- */

      return res
        .status(dbHealthy ? 200 : 503)
        .json({
          status: dbHealthy
            ? "ready"
            : "not_ready",

          checks: {
            database: {
              status: dbHealthy
                ? "healthy"
                : "unhealthy",
            },

            redis: {
              status: redisHealthy
                ? "healthy"
                : "degraded",
            },
          },

          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          requestId,
        });
    } catch (error) {
      /*
       * This catches:
       *
       * - readiness timeout
       * - Promise.allSettled failure
       * - unexpected programming errors
       * - synchronous dependency failures
       */

      const responseTime = Math.round(
        performance.now() - startTime
      );

      console.error(
        "[health/ready] Readiness check failed",
        {
          requestId,
          responseTime,
          error: getErrorMessage(error),
        }
      );

      return res.status(503).json({
        status: "not_ready",

        checks: {
          database: {
            status: "unknown",
          },

          redis: {
            status: "unknown",
          },
        },

        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        requestId,

        error: publicHealthError(error),
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 404 Protection                                                            */
/* -------------------------------------------------------------------------- */

/*
 * Optional health-specific fallback.
 *
 * This prevents unexpected health paths from falling through to some
 * unrelated application route.
 *
 * Example:
 *
 * /health/redis/something
 *
 * becomes a clean 404.
 */

router.use(
  (_req: Request, res: Response) => {
    return res.status(404).json({
      status: "error",
      service: "api",
      error: "health endpoint not found",
      timestamp: new Date().toISOString(),
    });
  }
);

export default router;