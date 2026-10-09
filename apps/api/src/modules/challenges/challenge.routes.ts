import { Router, type NextFunction, type Request, type Response } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { AppError } from "../../errors/app-error";
import { assertIsPlatformAdmin } from "../financial/financial.service";
import { challengeService } from "./challenge.service";
import { createChallengeSchema, leaderboardQuerySchema, updateChallengeSchema } from "./challenge.schema";

const router = Router();

function parse<T>(schema: { safeParse: (v: unknown) => any }, value: unknown, code: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "Invalid payload", { code, details: result.error.flatten().fieldErrors });
  }
  return result.data as T;
}

// Viewer-facing: the active challenge for this room's host region + standings.
router.get("/rooms/:id/challenge", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await challengeService.getForRoom(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/challenges/:id/leaderboard", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { limit } = parse<{ limit: number }>(leaderboardQuerySchema, req.query, "INVALID_QUERY");
    const hostId = typeof req.query.hostId === "string" ? req.query.hostId : null;
    const data = await challengeService.leaderboard(req.params.id, limit, hostId);
    res.status(200).json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Admin management.
router.get("/admin/challenges", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    res.status(200).json({ success: true, data: await challengeService.list() });
  } catch (e) {
    next(e);
  }
});

router.post("/admin/challenges", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    const input = parse<ReturnType<typeof createChallengeSchema.parse>>(createChallengeSchema, req.body, "INVALID_CHALLENGE");
    res.status(201).json({ success: true, data: await challengeService.create(req.user!.id, input) });
  } catch (e) {
    next(e);
  }
});

router.patch("/admin/challenges/:id", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    const input = parse<ReturnType<typeof updateChallengeSchema.parse>>(updateChallengeSchema, req.body, "INVALID_CHALLENGE");
    res.status(200).json({ success: true, data: await challengeService.update(req.params.id, input) });
  } catch (e) {
    next(e);
  }
});

export default router;
