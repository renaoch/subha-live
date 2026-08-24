import { Router } from "express";

import {
  testCloudflareConfig,
  testCreateSession,
  testPublishTracks,
} from "./media-test.controller";

const router =
  Router();

router.get(
  "/config",
  testCloudflareConfig,
);

router.post(
  "/session",
  testCreateSession,
);

router.post(
  "/tracks",
  testPublishTracks,
);

export default router;