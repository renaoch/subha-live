import express from "express";
import "dotenv/config";

// module-alias/register";
import healthRoutes from "./routes/health";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import socialRoutes from "./modules/social/social.routes";
import { errorMiddleware } from "./middleware/error.middleware";
const app = express();

const PORT = process.env.PORT || 3000;
const mode = process.env.NODE_ENV || 'development';

app.use(express.json());

// Health Check Routes
app.use("/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/users", socialRoutes);

app.use(errorMiddleware);
app.listen(PORT, () => {
  console.log(`Server is running in ${mode} mode on port ${PORT}`);
});
