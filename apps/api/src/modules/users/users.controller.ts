import { Request, Response, NextFunction } from "express";

import {
  getCurrentUser,
  getUserById,
  updateCurrentUser,
  recordProfileVisit,
} from "./users.service";

import {
  PrivateProfileResponse,
  PublicProfileResponse,
} from "./users.types";

import { updateMyProfileSchema } from "./users.schema";

import { AppError } from "../../errors/app-error";

// GET /api/v1/users/me
// Get the currently authenticated user's private profile

export async function getMyProfile(
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

    const user = await getCurrentUser(req.user.id);

    const response: PrivateProfileResponse = {
      status: "ok",
      user,
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/users/:id
// Get a user's public profile

export async function getPublicProfile(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError(
        400,
        "User ID is required",
        {
          code: "USER_ID_REQUIRED",
        },
      );
    }

    const user = await getUserById(id);

    // Fire-and-forget: log that req.user (if authenticated) viewed this
    // profile. Never blocks or fails the response.
    void recordProfileVisit(req.user?.id, id);

    const response: PublicProfileResponse = {
      status: "ok",
      user,
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/v1/users/me
// Update the currently authenticated user's profile

export async function updateMyProfile(
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

    const result = updateMyProfileSchema.safeParse(req.body);

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid profile data",
        {
          code: "INVALID_PROFILE_DATA",
          details: result.error.flatten().fieldErrors,
        },
      );
    }

    const user = await updateCurrentUser(
      req.user.id,
      result.data,
    );

    const response: PrivateProfileResponse = {
      status: "ok",
      user,
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}