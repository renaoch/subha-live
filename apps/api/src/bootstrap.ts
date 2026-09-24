import { app } from "./app";
import { connectRedis } from "./lib/redis";
import { cloudflareRealtimeProvider } from "./lib/media/cloudflare/cloudflare-realtime";
import { startPkFinalizer, stopPkFinalizer } from "./modules/pk/pk.finalizer";
import { startQuizFinalizer, stopQuizFinalizer } from "./modules/quiz/quiz.finalizer";

const PORT = Number(process.env.PORT) || 3000;
const mode = process.env.NODE_ENV || "development";

function logMediaProviderStatus() {
  const configured = cloudflareRealtimeProvider.isConfigured();

  if (!configured) {
    console.error(
      "[startup] Cloudflare Realtime is NOT configured — " +
        "CF_REALTIME_API_BASE / CF_REALTIME_APP_ID / CF_REALTIME_APP_SECRET " +
        "are missing from the environment. Publish/viewer session requests " +
        "will fail as soon as anyone tries to go live.",
    );
    return;
  }

  console.log(
    "[startup] Cloudflare Realtime configured:",
    cloudflareRealtimeProvider.getConfiguration(),
  );
}

export async function bootstrap() {
  // Redis is a cache/lock layer, not a hard dependency — getOrSetCache and
  // the cache helpers all fail safe without it. The server must still start
  // and accept requests (with CORS headers!) even if Redis is unreachable
  // at boot; otherwise a Redis outage takes the entire API down, the
  // reverse proxy in front of it has nothing to forward to, and every
  // request comes back as a bare 502 with no CORS headers — which shows up
  // in the browser as a misleading "CORS policy" error instead of the real
  // cause. So connectRedis() is attempted but never allowed to block or
  // kill startup; it keeps retrying in the background via its own
  // reconnectStrategy.
  connectRedis().catch((error) => {
    console.error(
      "[startup] Redis did not connect — continuing without it " +
        "(caching/locks disabled until it recovers):",
      error,
    );
  });

  try {
    logMediaProviderStatus();
    startPkFinalizer();
    startQuizFinalizer();

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running in ${mode} mode on port ${PORT}`);
    });

    const shutdown = (signal: string) => {
      console.log(`[shutdown] received ${signal}`);
      stopPkFinalizer();
      stopQuizFinalizer();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}