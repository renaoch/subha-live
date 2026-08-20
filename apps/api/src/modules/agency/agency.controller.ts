import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getAgencies,
  getMyAgency,
  getAgencyById,
  requestAgencyJoin,
  leaveAgency,
  getAgencyApplications,
  approveAgencyApplication,
  rejectAgencyApplication,
} from "./agency.service";

export async function listAgencies(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getAgencies();

    return res.status(200).json({
      status: "ok",
      agencies: result.agencies,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyAgencyController(
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

    const result = await getMyAgency(
      req.user.id,
    );

    return res.status(200).json({
      status: "ok",
      agency: result.agency,
      membershipStatus:
        result.membershipStatus,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAgency(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await getAgencyById(
      req.params.id,
    );

    return res.status(200).json({
      status: "ok",
      agency: result.agency,
      members: result.members,
    });
  } catch (error) {
    next(error);
  }
}

export async function joinAgency(
  req: Request<{ id: string }>,
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
      await requestAgencyJoin(
        req.user.id,
        req.params.id,
      );

    return res.status(201).json({
      status: "ok",
      application: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveMyAgency(
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

    await leaveAgency(
      req.user.id,
    );

    return res.status(200).json({
      status: "ok",
      message: "You have left the agency",
    });
  } catch (error) {
    next(error);
  }
}

export async function getApplications(
  req: Request<{ id: string }>,
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

    const applications =
      await getAgencyApplications(
        req.user.id,
        req.params.id,
      );

    return res.status(200).json({
      status: "ok",
      applications,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveApplication(
  req: Request<{
    id: string;
    userId: string;
  }>,
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

    await approveAgencyApplication(
      req.user.id,
      req.params.id,
      req.params.userId,
    );

    return res.status(200).json({
      status: "ok",
      message:
        "Agency application approved",
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectApplication(
  req: Request<{
    id: string;
    userId: string;
  }>,
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

    await rejectAgencyApplication(
      req.user.id,
      req.params.id,
      req.params.userId,
    );

    return res.status(200).json({
      status: "ok",
      message:
        "Agency application rejected",
    });
  } catch (error) {
    next(error);
  }
}