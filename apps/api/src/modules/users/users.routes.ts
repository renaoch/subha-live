import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware"
import {
  getMyProfile,
  getPublicProfile,
  updateMyProfile,
  getUserFollowers,
  getUserFollowing,
} from "./users.controller";

const router = Router();

router.get("/me", authMiddleware, getMyProfile);
router.patch("/me", authMiddleware, updateMyProfile);
router.get("/:id/followers", getUserFollowers);
router.get("/:id/following", getUserFollowing);
router.get("/:id", getPublicProfile);


export default router;