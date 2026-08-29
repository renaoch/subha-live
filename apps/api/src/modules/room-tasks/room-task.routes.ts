import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { getRoomTask, setRoomTask, cancelRoomTask } from "./room-task.controller";

const router = Router();

// Reading the task is public (no auth) — viewers need it to render the
// live progress bar in the header before/without ever calling an
// authenticated endpoint.
router.get("/:id/task", getRoomTask);

router.post("/:id/task", authMiddleware, setRoomTask);
router.delete("/:id/task", authMiddleware, cancelRoomTask);

export default router;
