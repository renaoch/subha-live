import { Router } from "express";

import { supabase } from "../lib/supabase";
import { redisHealth } from "../lib/redis";

const router = Router();

// Format helper
function formatUptime(seconds: number): string {
  let remaining = seconds;

  const days = Math.floor(remaining / 86400);
  remaining %= 86400;

  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;

  const minutes = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);

  const parts: string[] = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  parts.push(`${secs}s`);

  return parts.join(" ");
}

// Server Health Check Endpoint
router.get("/", (_req, res) => {
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
      environment: process.env.NODE_ENV || "development",
    },

    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
    },
  });
});

// Database Health Check Endpoint
router.get("/db", async (_req, res) => {
  const startTime = performance.now();

  try {
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    const responseTime = Math.round(performance.now() - startTime);

    if (error) {
      console.error("[health/db] Supabase health check failed:", error);

      return res.status(503).json({
        status: "error",
        service: "api",

        database: {
          status: "unhealthy",
          provider: "supabase",
          responseTime: `${responseTime}ms`,
        },

        timestamp: new Date().toISOString(),
        error: error.message,
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
    });
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    console.error("[health/db] Unexpected error:", error);

    return res.status(503).json({
      status: "error",
      service: "api",

      database: {
        status: "unhealthy",
        provider: "supabase",
        responseTime: `${responseTime}ms`,
      },

      timestamp: new Date().toISOString(),

      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Redis Health Check Endpoint
router.get("/redis", async (_req, res) => {
  const startTime = performance.now();

  try {
    await redisHealth();

    const responseTime = Math.round(performance.now() - startTime);

    return res.status(200).json({
      status: "ok",
      service: "api",

      redis: {
        status: "healthy",
        responseTime: `${responseTime}ms`,
      },

      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    console.error("[health/redis] Redis health check failed:", error);

    return res.status(503).json({
      status: "error",
      service: "api",

      redis: {
        status: "unhealthy",
        responseTime: `${responseTime}ms`,
      },

      timestamp: new Date().toISOString(),

      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Readiness Check
//
// Only Supabase (the database) is a hard dependency — every request needs
// it. Redis is a cache/lock layer that the app now degrades gracefully
// without (see getOrSetCache in lib/redis.ts), so it's reported here for
// visibility but never fails readiness on its own. Previously this endpoint
// went "not_ready" on any Redis hiccup; if the hosting platform uses this
// as a readiness probe, that pulled an otherwise-healthy instance out of
// rotation, leaving the reverse proxy with nothing to forward requests to —
// which surfaces to the browser as a misleading CORS error on a plain 502.
router.get("/ready", async (_req, res) => {
  const startTime = performance.now();

  const [dbResult, redisResult] = await Promise.allSettled([
    supabase.from("profiles").select("id").limit(1),
    redisHealth(),
  ]);

  const responseTime = Math.round(performance.now() - startTime);
  const dbHealthy = dbResult.status === "fulfilled" && !dbResult.value.error;
  const redisHealthy = redisResult.status === "fulfilled";

  const body = {
    status: dbHealthy ? "ready" : "not_ready",
    checks: {
      database: { status: dbHealthy ? "healthy" : "unhealthy" },
      redis: { status: redisHealthy ? "healthy" : "degraded" },
    },
    responseTime: `${responseTime}ms`,
    timestamp: new Date().toISOString(),
  };

  if (!redisHealthy) {
    console.warn("[health/ready] Redis unhealthy — continuing without it:", redisResult.status === "rejected" ? redisResult.reason : undefined);
  }

  return res.status(dbHealthy ? 200 : 503).json(body);
});

export default router;