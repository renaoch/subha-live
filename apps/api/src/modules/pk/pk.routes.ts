import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  invitePk,
  acceptPk,
  declinePk,
  startPk,
  cancelPk,
  getPk,
  getPkForRoom,
  listActivePk,
} from "./pk.controller";

const router = Router();

// Registered before the "/pk/:battleId" param route so "active" isn't
// swallowed as a battle id.
router.get("/pk/active", authMiddleware, listActivePk);
router.post("/pk/invite", authMiddleware, invitePk);
router.post("/pk/:battleId/accept", authMiddleware, acceptPk);
router.post("/pk/:battleId/decline", authMiddleware, declinePk);
router.post("/pk/:battleId/start", authMiddleware, startPk);
router.post("/pk/:battleId/cancel", authMiddleware, cancelPk);
router.get("/pk/for-room/:roomId", authMiddleware, getPkForRoom);
router.get("/pk/:battleId", authMiddleware, getPk);

export default router;
