import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../auth/auth.middleware";
import {
  adminListAllTasks,
  claimRoomTask,
  createRoomTask,
  deleteRoomTask,
  getActiveRoomTask,
  listRoomTasks,
  sendRoomHeartbeat,
  setRoomTaskStatus,
  updateRoomTask,
} from "./host-task.controller";

const router = Router();

// Viewer/host-facing read of the active task for a room. Public (viewers
// may not be logged in yet), but personalized when a token is present.
router.get("/rooms/:id/host-task", optionalAuthMiddleware, getActiveRoomTask);

// Host or admin: manage the room's tasks.
router.get("/rooms/:id/host-tasks", authMiddleware, listRoomTasks);
router.post("/rooms/:id/host-tasks", authMiddleware, createRoomTask);

// Streaming/watch-time heartbeat — feeds target_hours progress.
router.post("/rooms/:id/host-task/heartbeat", authMiddleware, sendRoomHeartbeat);

// Task-scoped actions (host/admin authorized server-side via room ownership).
router.patch("/host-tasks/:taskId", authMiddleware, updateRoomTask);
router.patch("/host-tasks/:taskId/status", authMiddleware, setRoomTaskStatus);
router.delete("/host-tasks/:taskId", authMiddleware, deleteRoomTask);
router.post("/host-tasks/:taskId/claim", authMiddleware, claimRoomTask);

// Global admin view across every room.
router.get("/admin/host-tasks", authMiddleware, adminListAllTasks);

export default router;
