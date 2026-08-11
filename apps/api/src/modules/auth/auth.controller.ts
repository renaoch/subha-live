import { Request, Response, NextFunction } from "express";
import { AppError } from "../../errors/app-error";

// GET /auth/me
// Returns the authenticated Supabase user.
// This is authentication-layer data not the application profile
export async function getMe(
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

    return res.status(200).json({
      status: "ok",
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
}