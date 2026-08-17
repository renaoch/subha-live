import { app } from "./app";
import { connectRedis } from "./lib/redis";

const PORT = Number(process.env.PORT) || 3000;
const mode = process.env.NODE_ENV || "development";

export async function bootstrap() {
  try {
    await connectRedis();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running in ${mode} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}