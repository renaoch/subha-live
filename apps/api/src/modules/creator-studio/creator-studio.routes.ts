import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { getCreatorOverview } from "./creator-studio.controller";

const router = Router();

router.get("/creator-studio/overview", authMiddleware, getCreatorOverview);

export default router;
