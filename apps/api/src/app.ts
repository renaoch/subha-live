import express from "express";

import healthRoutes from "./routes/health";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import socialRoutes from "./modules/social/social.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import roomRoutes from "./modules/rooms/room.routes";

const app = express();

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/users", socialRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use(errorMiddleware);

export { app };