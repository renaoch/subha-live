import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyFamilies,
  getPublicFamily,
  createFamily,
  joinFamily,
  leaveFamily,
} from "./family.service";

import {
  familyIdParamsSchema,
  createFamilySchema,
} from "./family.schema";

export async function getMyFamily(
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
      await getMyFamilies(
        req.user.id,
      );

    return res.status(200).json({
      status: "ok",
      families:
        result.families,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFamily(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed =
      familyIdParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid family ID",
        {
          code:
            "INVALID_FAMILY_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const family =
      await getPublicFamily(
        parsed.data.id,
      );

    return res.status(200).json({
      status: "ok",
      family,
    });
  } catch (error) {
    next(error);
  }
}

export async function createFamilyController(
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
      createFamilySchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid family data",
        {
          code:
            "INVALID_FAMILY_DATA",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const family =
      await createFamily(
        req.user.id,
        parsed.data,
      );

    return res
      .status(201)
      .json({
        status: "ok",
        family,
      });
  } catch (error) {
    next(error);
  }
}

export async function joinFamilyController(
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
      familyIdParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid family ID",
        {
          code:
            "INVALID_FAMILY_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const family =
      await joinFamily(
        req.user.id,
        parsed.data.id,
      );

    return res.status(200).json({
      status: "ok",
      family,
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveFamilyController(
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
      familyIdParamsSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid family ID",
        {
          code:
            "INVALID_FAMILY_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    await leaveFamily(
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