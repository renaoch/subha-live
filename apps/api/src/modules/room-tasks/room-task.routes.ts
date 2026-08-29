import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../auth/auth.middleware";
import {
  getRoomTask,
  setRoomTask,
  cancelRoomTask,
  claimRoomTask,
} from "./room-task.controller";

const router = Router();

// Reading the task is public (no auth required) — viewers need it to
// render the live progress bar in the header before/without ever calling
// an authenticated endpoint. We still run optionalAuthMiddleware so that
// *if* the viewer happens to be logged in, the response can include
// whether they personally already claimed the reward.
router.get("/:id/task", optionalAuthMiddleware, getRoomTask);

router.post("/:id/task", authMiddleware, setRoomTask);
router.delete("/:id/task", authMiddleware, cancelRoomTask);

// Claiming requires auth — this is where coins actually move, so the
// backend independently re-verifies completion/eligibility/idempotency
// (see room-task.service.claimReward) rather than trusting the client.
router.post("/:id/task/claim", authMiddleware, claimRoomTask);

export default router;
