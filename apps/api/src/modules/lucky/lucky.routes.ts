import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { rateLimit } from "../../lib/rate-limit";
import {
  getLuckyConfig,
  getLuckyState,
  spinLucky,
  getLuckyHistory,
} from "./lucky.controller";

const router = Router();

// Public config (symbols/paytable/bets) — non-sensitive, used to render the UI.
router.get("/lucky/config", getLuckyConfig);

// Spin — the economically-sensitive endpoint: rate-limited server-side.
router.post("/lucky/spin", authMiddleware, rateLimit("lucky:spin"), spinLucky);

// Game shell state (config + today's winnings + recent results).
router.get("/lucky/state", authMiddleware, getLuckyState);
router.get("/lucky/history", authMiddleware, getLuckyHistory);

export default router;
