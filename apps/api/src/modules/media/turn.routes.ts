import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";
import { getTurnCredentials } from "./turn.controller";

const router = Router();

router.get("/turn-credentials", authMiddleware, getTurnCredentials);

export default router;