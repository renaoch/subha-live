import express from "express";
import cors from "cors";

import healthRoutes from "./routes/health";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import socialRoutes from "./modules/social/social.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import roomRoutes from "./modules/rooms/room.routes";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "https://www.subha.fun,https://subha.fun")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));
app.use(express.json({ limit: "256kb" }));

app.use("/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/users", socialRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use(errorMiddleware);

export { app };
