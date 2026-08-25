import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  getMediaState,
  publishHost,
  publishGuest,
  unpublishGuest,
  createViewerSession,
  completeRenegotiation,
  leaveViewer,
  mediaHeartbeat,
} from "./room-media.controller";

const router = Router();

router.get("/:id/media", authMiddleware, getMediaState);
router.post("/:id/media/host/publish", authMiddleware, publishHost);
router.post("/:id/media/guest/publish", authMiddleware, publishGuest);
router.delete("/:id/media/guest", authMiddleware, unpublishGuest);
router.post("/:id/media/viewer/session", authMiddleware, createViewerSession);
router.post("/:id/media/viewer/renegotiate", authMiddleware, completeRenegotiation);
router.delete("/:id/media/viewer", authMiddleware, leaveViewer);
router.post("/:id/media/heartbeat", authMiddleware, mediaHeartbeat);

export default router;
