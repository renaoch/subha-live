import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  createRoom,
  getRoom,
  startRoom,
  endRoom,
} from "./room.controller";

const router = Router();

router.post("/", authMiddleware, createRoom);
router.get("/:id", authMiddleware, getRoom);
router.post("/:id/start", authMiddleware, startRoom);
router.post("/:id/end", authMiddleware, endRoom);

export default router;