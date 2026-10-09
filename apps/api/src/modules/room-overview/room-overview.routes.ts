import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { roomOverviewService } from "./room-overview.service";

const router = Router();

router.get("/:id/overview", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await roomOverviewService.getOverview(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
