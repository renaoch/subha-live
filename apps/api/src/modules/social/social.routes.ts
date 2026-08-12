import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";
import { followUserController,  unfollowUserController, getFollowersController, getFollowingController, getFollowStatusController,} from "./social.controller";

const router = Router();

router.get("/:id/followers", getFollowersController);
router.get("/:id/following", getFollowingController);
router.get("/:id/follow-status",authMiddleware, getFollowStatusController);
router.post("/:id/follow", authMiddleware, followUserController);
router.delete("/:id/follow", authMiddleware, unfollowUserController);

export default router;