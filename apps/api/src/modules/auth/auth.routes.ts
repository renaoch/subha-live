import { Router } from "express";
import { authMiddleware } from "./auth.middleware";
import { getMe } from "./auth.controller";

const router = Router();

router.get("/me", authMiddleware, getMe);

export default router;