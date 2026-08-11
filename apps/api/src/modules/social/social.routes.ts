import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";
import { followUserController,  unfollowUserController, } from "./social.controller";

const router = Router();

router.post("/:id/follow", authMiddleware, followUserController);
router.delete("/:id/follow", authMiddleware, unfollowUserController);

export default router;