import { Router } from "express";
import roomMediaRoutes from "./room-media.routes";
import { authMiddleware } from "../auth/auth.middleware";
import { listRooms, createRoom, getRoom, startRoom, endRoom } from "./room.controller";
import { joinRoom, leaveRoom } from "./room-participant.controller";
import {
  createSpeakerRequest,
  cancelSpeakerRequest,
  listSpeakerRequests,
  approveSpeakerRequest,
  rejectSpeakerRequest,
  acceptHostInvitation,
  removeSpeaker,
} from "./room-request.controller";

const router = Router();

router.get("/", authMiddleware, listRooms);
router.post("/", authMiddleware, createRoom);
router.get("/:id", authMiddleware, getRoom);
router.post("/:id/start", authMiddleware, startRoom);
router.post("/:id/end", authMiddleware, endRoom);

router.post("/:id/join", authMiddleware, joinRoom);
router.post("/:id/leave", authMiddleware, leaveRoom);

router.post("/:id/speaker-request", authMiddleware, createSpeakerRequest);
router.delete("/:id/speaker-request", authMiddleware, cancelSpeakerRequest);
router.get("/:id/speaker-requests", authMiddleware, listSpeakerRequests);
router.post(
  "/:id/speaker-requests/:requestId/approve",
  authMiddleware,
  approveSpeakerRequest,
);
router.post(
  "/:id/speaker-requests/:requestId/reject",
  authMiddleware,
  rejectSpeakerRequest,
);
router.post(
  "/:id/speaker-requests/:requestId/accept",
  authMiddleware,
  acceptHostInvitation,
);
router.delete(
  "/:id/speakers/:userId",
  authMiddleware,
  removeSpeaker,
);

router.use("/", roomMediaRoutes);

// Backward-compatible endpoints.
router.post("/:id/audio-request", authMiddleware, createSpeakerRequest);
router.delete("/:id/audio-request", authMiddleware, cancelSpeakerRequest);

export default router;
