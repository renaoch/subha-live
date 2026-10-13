import {
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  kickSpeaker,
  kickSpeakerParam,
  listModeration,
  myModeration,
} from "./room-moderation.controller";
import { Router } from "express";
import roomMediaRoutes from "./room-media.routes";
import roomTaskRoutes from "../room-tasks/room-task.routes";
import roomOverviewRoutes from "../room-overview/room-overview.routes";
import { authMiddleware } from "../auth/auth.middleware";
import { listRooms, createRoom, getRoom, startRoom, endRoom, authorizeRoom } from "./room.controller";
import { joinRoom, leaveRoom } from "./room-participant.controller";
import { reportRoom } from "./room-report.controller";
import {
  createSpeakerRequest,
  cancelSpeakerRequest,
  getMyRequestStatus,
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
router.get("/:id/authorize", authMiddleware, authorizeRoom);
router.post("/:id/start", authMiddleware, startRoom);
router.post("/:id/end", authMiddleware, endRoom);

router.post("/:id/join", authMiddleware, joinRoom);
router.post("/:id/leave", authMiddleware, leaveRoom);
router.post("/:id/report", authMiddleware, reportRoom);

router.post("/:id/speaker-request", authMiddleware, createSpeakerRequest);
router.delete("/:id/speaker-request", authMiddleware, cancelSpeakerRequest);
router.get("/:id/speaker-requests", authMiddleware, listSpeakerRequests);
router.get("/:id/speaker-requests/mine", authMiddleware, getMyRequestStatus);
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
  // Full teardown (SFU session + stage state + role), not just a Redis flag.
  (req, res, next) => kickSpeakerParam(req as never, res, next),
);

// Host moderation: block / mute / kick-from-stage (see room-moderation.*).
router.get("/:id/moderation", authMiddleware, listModeration);
router.get("/:id/moderation/me", authMiddleware, myModeration);
router.post("/:id/moderation/block", authMiddleware, blockUser);
router.delete("/:id/moderation/block/:userId", authMiddleware, unblockUser);
router.post("/:id/moderation/mute", authMiddleware, muteUser);
router.delete("/:id/moderation/mute/:userId", authMiddleware, unmuteUser);
router.post("/:id/moderation/kick-speaker", authMiddleware, kickSpeaker);

router.use("/", roomMediaRoutes);
router.use("/", roomTaskRoutes);
router.use("/", roomOverviewRoutes);

// Backward-compatible endpoints.
router.post("/:id/audio-request", authMiddleware, createSpeakerRequest);
router.delete("/:id/audio-request", authMiddleware, cancelSpeakerRequest);

export default router;