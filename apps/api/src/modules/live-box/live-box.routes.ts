import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../auth/auth.middleware";
import { AppError } from "../../errors/app-error";
import { assertIsPlatformAdmin } from "../financial/financial.service";
import { liveBoxService } from "./live-box.service";

const router = Router();

const settingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  intervalSeconds: z.coerce.number().int().min(30).max(3600).optional(),
  rewardCoins: z.coerce.number().int().min(0).max(1_000_000).optional(),
  dailyLimit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get("/rooms/:id/live-box", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await liveBoxService.status(req.user!.id, req.params.id) });
  } catch (e) {
    next(e);
  }
});

router.post("/rooms/:id/live-box/claim", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await liveBoxService.claim(req.user!.id, req.params.id) });
  } catch (e) {
    next(e);
  }
});

router.get("/admin/live-box", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    res.status(200).json({ success: true, data: await liveBoxService.getSettings() });
  } catch (e) {
    next(e);
  }
});

router.put("/admin/live-box", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid settings", { code: "INVALID_LIVE_BOX_SETTINGS", details: parsed.error.flatten().fieldErrors });
    }
    res.status(200).json({ success: true, data: await liveBoxService.updateSettings(parsed.data) });
  } catch (e) {
    next(e);
  }
});

export default router;
