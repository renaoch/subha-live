import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { creatorStudioService } from "./creator-studio.service";

export async function getCreatorOverview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
    }
    const overview = await creatorStudioService.getOverview(req.user.id);
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}
