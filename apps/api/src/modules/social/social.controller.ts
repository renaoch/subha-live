import { Request, Response, NextFunction } from "express";

import { followUser, unfollowUser} from "./social.service";

import { AppError } from "../../errors/app-error";

// follow a user
export async function followUserController(
  req: Request<{ id: string }>,
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

    const { id } = req.params;

    const follow = await followUser(
      req.user.id,
      id
    );

    return res.status(201).json({
      status: "ok",
      follow,
    });
  } catch (error) {
    next(error);
  }
}

// unfollow a user
export async function unfollowUserController(
  req: Request<{ id: string }>,
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

    const { id } = req.params;

    const unfollow = await unfollowUser(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      unfollow,
    });
  } catch (error) {
    next(error);
  }
}