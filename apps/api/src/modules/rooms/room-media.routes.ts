import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  getMediaState,
  publishHost,
  publishGuest,
  subscribeHostToGuests,
  subscribeViewerToSpeakers,
  unpublishGuest,
  createViewerSession,
  completeRenegotiation,
  leaveViewer,
  mediaHeartbeat,
  getStage,
  reportStage,
  leaveSeat,
} from "./room-media.controller";

const router = Router();

router.get("/:id/media", authMiddleware, getMediaState);
router.post("/:id/media/host/publish", authMiddleware, publishHost);
router.post("/:id/media/guest/publish", authMiddleware, publishGuest);
router.post("/:id/media/host/subscribe", authMiddleware, subscribeHostToGuests);
router.post("/:id/media/viewer/subscribe", authMiddleware, subscribeViewerToSpeakers);
router.delete("/:id/media/guest", authMiddleware, unpublishGuest);
router.post("/:id/media/viewer/session", authMiddleware, createViewerSession);
router.post("/:id/media/viewer/renegotiate", authMiddleware, completeRenegotiation);
router.delete("/:id/media/viewer", authMiddleware, leaveViewer);
router.post("/:id/media/heartbeat", authMiddleware, mediaHeartbeat);

// Audio party-room stage: cheap poll + self-report, see room-stage.service.ts
router.get("/:id/stage", authMiddleware, getStage);
router.post("/:id/stage/report", authMiddleware, reportStage);
router.delete("/:id/stage/seat", authMiddleware, leaveSeat);

export default router;