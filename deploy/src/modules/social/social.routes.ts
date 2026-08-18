import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";
import { followUserController,  unfollowUserController, getFollowersController, getFollowingController, getFollowStatusController, blockUserController, unblockUserController, getBlockStatusController, muteUserController, unmuteUserController, getMuteStatusController,} from "./social.controller";

const router = Router();

router.get("/:id/followers", getFollowersController);
router.get("/:id/following", getFollowingController);

router.get("/:id/follow-status",authMiddleware, getFollowStatusController);
router.post("/:id/follow", authMiddleware, followUserController);
router.delete("/:id/follow", authMiddleware, unfollowUserController);

router.post("/:id/block", authMiddleware, blockUserController);
router.delete("/:id/block", authMiddleware, unblockUserController);
router.get("/:id/block-status", authMiddleware, getBlockStatusController);

router.post("/:id/mute", authMiddleware, muteUserController);
router.delete("/:id/mute", authMiddleware, unmuteUserController);
router.get("/:id/mute-status", authMiddleware, getMuteStatusController);

export default router;