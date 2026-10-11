import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../auth/auth.middleware";
import { AppError } from "../../errors/app-error";
import { assertIsPlatformAdmin } from "../financial/financial.service";
import { banService } from "../moderation/ban.service";
import { banUserSchema, unbanUserSchema } from "../moderation/ban.schema";
import { adminUsersService } from "./admin-users.service";

const router = Router();

const listQuerySchema = z.object({
  search: z.string().max(80).optional(),
  filter: z.enum(["all", "banned", "admins", "verified", "vip"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

const idParam = z.string().uuid();

function invalid(details: unknown, code: string): never {
  throw new AppError(400, "Invalid request", { code, details });
}

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) invalid(parsed.error.flatten().fieldErrors, "INVALID_QUERY");
    res.status(200).json({ success: true, data: await adminUsersService.list(req.user!.id, parsed.data!) });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    if (!idParam.safeParse(req.params.id).success) invalid(undefined, "INVALID_USER_ID");
    res.status(200).json({ success: true, data: await adminUsersService.detail(req.user!.id, req.params.id) });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/ban", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    if (!idParam.safeParse(req.params.id).success) invalid(undefined, "INVALID_USER_ID");
    const parsed = banUserSchema.safeParse(req.body);
    if (!parsed.success) invalid(parsed.error.flatten().fieldErrors, "INVALID_BAN");
    const ban = await banService.ban(req.user!.id, req.params.id, parsed.data!);
    res.status(201).json({ success: true, data: ban });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/unban", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await assertIsPlatformAdmin(req.user!.id);
    if (!idParam.safeParse(req.params.id).success) invalid(undefined, "INVALID_USER_ID");
    const parsed = unbanUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) invalid(parsed.error.flatten().fieldErrors, "INVALID_UNBAN");
    res.status(200).json({ success: true, data: await banService.unban(req.user!.id, req.params.id, parsed.data!.note) });
  } catch (e) {
    next(e);
  }
});

export default router;
