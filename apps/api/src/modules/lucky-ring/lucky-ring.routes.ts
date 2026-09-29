import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { rateLimit } from "../../lib/rate-limit";
import { getLuckyRingConfig, getLuckyRingState, placeLuckyRingBet } from "./lucky-ring.controller";

const router = Router();

// Public config (cells/paytable/bets) — non-sensitive, used to render the UI.
router.get("/lucky-ring/config", getLuckyRingConfig);

// Current room round: phase, timer, my bets, balance, recent results. Polled
// by the client (see apps/web/hooks/useLuckyRing.ts) until a dedicated
// WebSocket gateway exists — see the note in lucky-ring.events.ts.
router.get("/lucky-ring/state", authMiddleware, getLuckyRingState);

// Bet — the economically-sensitive endpoint: rate-limited server-side.
router.post(
  "/lucky-ring/bet",
  authMiddleware,
  rateLimit("lucky_ring:bet", { max: 30, windowSeconds: 10 }),
  placeLuckyRingBet,
);

export default router;