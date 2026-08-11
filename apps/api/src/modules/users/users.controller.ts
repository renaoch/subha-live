import { Request, Response, NextFunction } from "express";
import { getCurrentUser, getUserById, updateCurrentUser } from "./users.service";
import { updateMyProfileSchema } from "./users.schema";


export async function getMyProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
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

export async function updateMyProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    const result = updateMyProfileSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        status: "error",
        message: "Invalid profile data",
        errors: result.error.flatten().fieldErrors,
      });
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