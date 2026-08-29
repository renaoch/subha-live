import express from "express";
    import cors from "cors";

    import healthRoutes from "./routes/health";
    import authRoutes from "./modules/auth/auth.routes";
    import userRoutes from "./modules/users/users.routes";
    import socialRoutes from "./modules/social/social.routes";
    import levelRoutes from "./modules/levels/levels.routes";
    import roomRoutes from "./modules/rooms/room.routes";
    import tasksRoutes from "./modules/tasks/tasks.routes";
    import vipRoutes from "./modules/vip/vip.routes";
    import familyRoutes from "./modules/family/family.routes";
    import cpRoutes from "./modules/cp/cp.routes";
    import bdRoutes from "./modules/bd/bd.routes";
    import agencyRoutes from "./modules/agency/agency.routes";
    import walletRoutes from "./modules/wallet/wallet.routes";
    import offlineRechargeRoutes from "./modules/offline-recharge/offline-recharge.routes";
    import mediaTestRoutes from "./modules/media/media-test.routes";
import turnRoutes from "./modules/media/turn.routes";
import charismaRoutes from "./modules/charisma/charisma.routes";
import hostTaskRoutes from "./modules/host-task/host-task.routes";
    import { errorMiddleware } from "./middleware/error.middleware";



    const app = express();
    app.set("trust proxy", 1);
    app.disable("x-powered-by");

    const allowedOrigins = (process.env.CORS_ORIGINS || "https://www.subha.fun,https://subha.fun")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

    const corsOptions = {
        origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
            callback(null, !origin || allowedOrigins.includes(origin));
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
    app.use("/api/v1/levels", levelRoutes);
    app.use("/api/v1/tasks", tasksRoutes);
    app.use("/api/v1/agency", agencyRoutes);
    app.use(
    "/api/v1/family",
    familyRoutes,
    );
    app.use(
    "/api/v1/vip",
    vipRoutes,
    );
    app.use("/api/v1/bd", bdRoutes);
    app.use("/api/v1/cp", cpRoutes);
    app.use("/api/v1/offline-recharge", offlineRechargeRoutes);
    app.use("/api/v1/wallet", walletRoutes);
    app.use("/api/v1/charisma", charismaRoutes);
    app.use("/api/v1", hostTaskRoutes);
    app.use(
  "/api/v1/media/test",
  mediaTestRoutes,
);
    app.use(
  "/api/v1/media",
  turnRoutes,
);
    app.use(errorMiddleware);

    export { app };