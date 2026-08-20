import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyVip,
  getMyVipSubscription,
} from "./vip.service";

import {
  vipSubscriptionParamsSchema,
} from "./vip.schema";

export async function getMyVipController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code:
            "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const result =
      await getMyVip(
        req.user.id,
      );

    return res.status(200).json({
      status: "ok",
      vip: result.status,
      subscriptions:
        result.subscriptions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyVipSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code:
            "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const parsed =
      vipSubscriptionParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid subscription ID",
        {
          code:
            "INVALID_VIP_SUBSCRIPTION_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const subscription =
      await getMyVipSubscription(
        req.user.id,
        parsed.data.id,
      );

    return res.status(200).json({
      status: "ok",
      subscription,
    });
  } catch (error) {
    next(error);
  }
}