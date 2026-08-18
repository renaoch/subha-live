import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

//format hellper
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

//Server Health Check Endpoint
router.get("/", (_req, res) => {
  const memory = process.memoryUsage();

  res.status(200).json({
    status: "ok",
    service: "api",
    server: "healthy",

    uptime: {
      seconds: Math.floor(process.uptime()),
      human: formatUptime(process.uptime()),
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

    return res.status(503).json({
      status: "error",
      service: "api",
      database: {
        status: "unhealthy",
        provider: "supabase",
        responseTime: `${responseTime}ms`,
      },
      timestamp: new Date().toISOString(),
    });
  }
});
export default router;