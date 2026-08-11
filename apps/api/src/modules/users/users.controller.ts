import { Request, Response, NextFunction } from "express";
import {
  getCurrentUser,
  getUserById,
  updateCurrentUser
} from "./users.service";
import { updateMyProfileSchema } from "./users.schema";
import { AppError } from "../../errors/app-error";


// get user
export async function getMyProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const user = await getCurrentUser(req.user.id);

    return res.status(200).json({
      status: "ok",
      user,
    });
  } catch (error) {
    next(error);
  }
}

// get user by id
export async function getPublicProfile(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const user = await getUserById(id);

    return res.status(200).json({
      status: "ok",
      user,
    });
  } catch (error) {
    next(error);
  }
}

// cahnge current user details
export async function updateMyProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
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
        }
      );
    }

    const user = await updateCurrentUser(
      req.user.id,
      result.data
    );

    return res.status(200).json({
      status: "ok",
      user,
    });
  } catch (error) {
    next(error);
  }
}

