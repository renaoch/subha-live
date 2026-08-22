import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyCharisma,
  getMyGifts,
  sendGift,
} from "./charisma.service";

import {
  giftListQuerySchema,
  sendGiftSchema,
} from "./charisma.schema";

export async function getMyCharismaController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        { code: "AUTHENTICATION_REQUIRED" },
      );
    }

    const result = await getMyCharisma(req.user.id);

    return res.status(200).json({
      status: "ok",
      charisma: result.progress,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyGiftsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        { code: "AUTHENTICATION_REQUIRED" },
      );
    }

    const result = giftListQuerySchema.safeParse(req.query);

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid gift list query",
        {
          code: "INVALID_GIFT_LIST_QUERY",
          details: result.error.flatten().fieldErrors,
        },
      );
    }

    const gifts = await getMyGifts(req.user.id, result.data);

    return res.status(200).json({
      status: "ok",
      gifts: gifts.gifts,
      totalValue: gifts.totalValue,
      count: gifts.count,
    });
  } catch (error) {
    next(error);
  }
}

export async function sendGiftController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        { code: "AUTHENTICATION_REQUIRED" },
      );
    }

    const result = sendGiftSchema.safeParse(req.body);

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid gift payload",
        {
          code: "INVALID_GIFT_PAYLOAD",
          details: result.error.flatten().fieldErrors,
        },
      );
    }

    const gift = await sendGift(req.user.id, result.data);

    return res.status(201).json({
      status: "ok",
      gift,
    });
  } catch (error) {
    next(error);
  }
}