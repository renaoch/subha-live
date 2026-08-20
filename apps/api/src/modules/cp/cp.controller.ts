import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyCp,
  getCpById,
  createCp,
  endCp,
} from "./cp.service";

import {
  cpIdParamsSchema,
  createCpSchema,
} from "./cp.schema";

export async function getMyCpController(
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
      await getMyCp(
        req.user.id,
      );

    return res.status(200).json({
      status: "ok",
      partnership:
        result.partnership,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCpController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed =
      cpIdParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid CP partnership ID",
        {
          code:
            "INVALID_CP_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const partnership =
      await getCpById(
        parsed.data.id,
      );

    return res.status(200).json({
      status: "ok",
      partnership,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCpController(
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
      createCpSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid CP data",
        {
          code:
            "INVALID_CP_DATA",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const partnership =
      await createCp(
        req.user.id,
        parsed.data.partnerId,
        parsed.data.ringName ??
          null,
      );

    return res
      .status(201)
      .json({
        status: "ok",
        partnership,
      });
  } catch (error) {
    next(error);
  }
}

export async function endCpController(
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
      cpIdParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid CP partnership ID",
        {
          code:
            "INVALID_CP_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    await endCp(
      req.user.id,
      parsed.data.id,
    );

    return res.status(200).json({
      status: "ok",
    });
  } catch (error) {
    next(error);
  }
}