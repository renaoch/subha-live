import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { commissionService } from "./commission.service";
import { commissionAgencyIdSchema, setRateSchema } from "./commission.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

function agencyId(req: Request<{ agencyId: string }>): string {
  const parsed = commissionAgencyIdSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError(400, "Invalid agency id", { code: "INVALID_AGENCY_ID" });
  }
  return parsed.data.agencyId;
}

export async function getCommissionState(req: Request<{ agencyId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const state = await commissionService.getState(user.id, agencyId(req));
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function setCommissionRate(req: Request<{ agencyId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = setRateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid commission rate", { code: "INVALID_COMMISSION_RATE" });
    }
    const state = await commissionService.setRate(user.id, agencyId(req), parsed.data.commissionRate);
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}
