import { app } from "./app";
import { connectRedis } from "./lib/redis";
import { cloudflareRealtimeProvider } from "./lib/media/cloudflare/cloudflare-realtime";

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
  try {
    await connectRedis();

    logMediaProviderStatus();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running in ${mode} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}