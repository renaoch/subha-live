import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyBd,
  createBdApplication,
} from "./bd.service";

import {
  createBdApplicationSchema,
} from "./bd.schema";

export async function getMyBdController(
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
      await getMyBd(
        req.user.id,
      );

    return res.status(200).json({
      status: "ok",
      application:
        result.application,
    });
  } catch (error) {
    next(error);
  }
}

export async function createBdApplicationController(
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
      createBdApplicationSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid BD application data",
        {
          code:
            "INVALID_BD_APPLICATION_DATA",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const application =
      await createBdApplication(
        req.user.id,
        parsed.data,
      );

    return res
      .status(201)
      .json({
        status: "ok",
        application,
      });
  } catch (error) {
    next(error);
  }
}