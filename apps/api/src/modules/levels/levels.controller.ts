import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyLevel,
  getLevelRewards,
  getMyLevelHistory,
} from "./levels.service";

import {
  levelHistoryQuerySchema,
} from "./levels.schema";

export async function getMyLevelController(
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
          code: "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const result = await getMyLevel(
      req.user.id,
    );

    return res.status(200).json({
      status: "ok",
      level: result.progress,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLevelRewardsController(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result =
      await getLevelRewards();

    return res.status(200).json({
      status: "ok",
      rewards: result.rewards,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyLevelHistoryController(
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
          code: "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const result =
      levelHistoryQuerySchema.safeParse(
        req.query,
      );

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid level history query",
        {
          code: "INVALID_LEVEL_HISTORY_QUERY",
          details:
            result.error.flatten()
              .fieldErrors,
        },
      );
    }

    const history =
      await getMyLevelHistory(
        req.user.id,
        result.data,
      );

    return res.status(200).json({
      status: "ok",
      history: history.history,
    });
  } catch (error) {
    next(error);
  }
}