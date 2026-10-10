import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../auth/auth.middleware";
import { AppError } from "../../errors/app-error";
import { wishService, MAX_WISHES } from "./wish.service";

const router = Router();

const replaceSchema = z.object({
  wishes: z
    .array(z.object({ giftId: z.string().uuid(), targetCount: z.coerce.number().int().min(1).max(999) }))
    .max(MAX_WISHES),
});

router.get("/rooms/:id/wishes", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await wishService.list(req.params.id) });
  } catch (e) {
    next(e);
  }
});

router.put("/rooms/:id/wishes", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const parsed = replaceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid wishes", { code: "INVALID_WISHES", details: parsed.error.flatten().fieldErrors });
    }
    res.status(200).json({ success: true, data: await wishService.replace(req.params.id, req.user!.id, parsed.data.wishes) });
  } catch (e) {
    next(e);
  }
});

export default router;
