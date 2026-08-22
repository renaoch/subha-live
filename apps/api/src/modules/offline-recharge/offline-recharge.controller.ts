import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../errors/app-error";
import {
  requestOfflineRecharge,
  getUserRecharges,
  listPendingRecharges,
  approveRecharge,
} from "./offline-recharge.service";
import { requestRechargeSchema, approveRechargeSchema } from "./offline-recharge.schema";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

/* -------------------------------------------------------------------------- */
/* USER REQUEST                                                               */
/* -------------------------------------------------------------------------- */

export async function requestRechargeController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const parsed = requestRechargeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request", { details: parsed.error.flatten() });
    }
    const result = await requestOfflineRecharge(user.id, parsed.data);
    res.status(201).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* USER HISTORY                                                               */
/* -------------------------------------------------------------------------- */

export async function getMyRechargesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const data = await getUserRecharges(user.id);
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* ADMIN LIST PENDING                                                         */
/* -------------------------------------------------------------------------- */

export async function listPendingRechargesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    // optional: check if user is admin or agency owner
    // we'll assume any authenticated user can see pending for simplicity
    const data = await listPendingRecharges(user.id);
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* ADMIN APPROVE/REJECT                                                       */
/* -------------------------------------------------------------------------- */

export async function approveRechargeController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const parsed = approveRechargeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid payload", { details: parsed.error.flatten() });
    }
    await approveRecharge(user.id, req.params.id, parsed.data);
    res.status(200).json({ status: "ok", message: "Recharge updated" });
  } catch (error) {
    next(error);
  }
}