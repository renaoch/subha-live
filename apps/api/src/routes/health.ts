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
router.get("/ready", async (_req, res) => {
  const startTime = performance.now();

  try {
    await redisHealth();

    const responseTime = Math.round(performance.now() - startTime);

    return res.status(200).json({
      status: "ready",

      checks: {
        redis: {
          status: "healthy",
          responseTime: `${responseTime}ms`,
        },
      },

      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    console.error("[health/ready] Redis readiness check failed:", error);

    return res.status(503).json({
      status: "not_ready",

      checks: {
        redis: {
          status: "unhealthy",
          responseTime: `${responseTime}ms`,
        },
      },

      timestamp: new Date().toISOString(),

      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;