import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  invitePk,
  acceptPk,
  declinePk,
  startPk,
  cancelPk,
  getPk,
} from "./pk.controller";

const router = Router();

router.post("/pk/invite", authMiddleware, invitePk);
router.post("/pk/:battleId/accept", authMiddleware, acceptPk);
router.post("/pk/:battleId/decline", authMiddleware, declinePk);
router.post("/pk/:battleId/start", authMiddleware, startPk);
router.post("/pk/:battleId/cancel", authMiddleware, cancelPk);
router.get("/pk/:battleId", authMiddleware, getPk);

export default router;
