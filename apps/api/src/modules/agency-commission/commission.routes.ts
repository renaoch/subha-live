import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { getCommissionState, setCommissionRate } from "./commission.controller";

const router = Router();

router.get("/agency-commission/:agencyId", authMiddleware, getCommissionState);
router.post("/agency-commission/:agencyId/rate", authMiddleware, setCommissionRate);

export default router;
