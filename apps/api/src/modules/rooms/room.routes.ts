import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { createRoom, getRoom, startRoom, endRoom } from "./room.controller";
import { joinRoom, leaveRoom, } from "./room-participant.controller";
import { createAudioRequest, cancelAudioRequest, } from "./room-request.controller";

const router = Router();

router.post("/", authMiddleware, createRoom);
router.get("/:id", authMiddleware, getRoom);
router.post("/:id/start", authMiddleware, startRoom);
router.post("/:id/end", authMiddleware, endRoom);

router.post("/:id/join", authMiddleware, joinRoom);
router.post("/:id/leave", authMiddleware, leaveRoom);

router.post("/:id/audio-request", authMiddleware, createAudioRequest);
router.delete("/:id/audio-request", authMiddleware, cancelAudioRequest);

export default router;