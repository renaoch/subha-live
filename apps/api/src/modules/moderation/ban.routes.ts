import { Router, type NextFunction, type Request, type Response } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { getActiveBan } from "./ban.service";

const router = Router();

/**
 * The ONE authenticated endpoint a banned user may still call (see the
 * allow-list in auth.middleware): the app uses it to learn whether to show the
 * ban screen, and to notice when a temporary ban has ended.
 */
router.get("/me/ban", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ban = await getActiveBan(req.user!.id);
    res.status(200).json({ success: true, data: { banned: ban !== null, ban, serverNow: new Date().toISOString() } });
  } catch (e) {
    next(e);
  }
});

export default router;
