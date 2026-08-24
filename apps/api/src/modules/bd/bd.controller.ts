import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyBd,
  createBdApplication,
  listBdApplications,
  approveBdApplication,
  rejectBdApplication,
} from "./bd.service";

import {
  createBdApplicationSchema,
  bdApplicationIdParamsSchema,
} from "./bd.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(
      401,
      "Authentication required",
      {
        code: "AUTHENTICATION_REQUIRED",
      },
    );
  }

  return req.user;
}

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

/* ========================================================================== */
/* ADMIN                                                                      */
/* ========================================================================== */

// GET /api/v1/bd/applications
// Admin only. Lists every agency-owner application.

export async function listBdApplicationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);

    const applications = await listBdApplications(
      user.id,
    );

    return res.status(200).json({
      status: "ok",
      applications,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/bd/applications/:id/approve
// Admin only.

export async function approveBdApplicationController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);

    const parsed = bdApplicationIdParamsSchema.safeParse(
      req.params,
    );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid application ID",
        {
          code: "INVALID_BD_APPLICATION_ID",
        },
      );
    }

    const result = await approveBdApplication(
      user.id,
      parsed.data.id,
    );

    return res.status(200).json({
      status: "ok",
      application: result.application,
      agency: result.agency,
      message:
        "Application approved. A new agency has been created for this user.",
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/bd/applications/:id/reject
// Admin only.

export async function rejectBdApplicationController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);

    const parsed = bdApplicationIdParamsSchema.safeParse(
      req.params,
    );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid application ID",
        {
          code: "INVALID_BD_APPLICATION_ID",
        },
      );
    }

    const application = await rejectBdApplication(
      user.id,
      parsed.data.id,
    );

    return res.status(200).json({
      status: "ok",
      application,
      message: "Application rejected.",
    });
  } catch (error) {
    next(error);
  }
}