import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  listConversations,
  getFriendship,
  getThread,
  sendMessage,
} from "./messages.controller";

const router = Router();

router.get("/messages/conversations", authMiddleware, listConversations);
router.get("/messages/:userId/friendship", authMiddleware, getFriendship);
router.get("/messages/:userId", authMiddleware, getThread);
router.post("/messages/:userId", authMiddleware, sendMessage);

export default router;
