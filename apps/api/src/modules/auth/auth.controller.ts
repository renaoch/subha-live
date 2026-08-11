import { Request, Response, NextFunction } from "express";


// get authenticated User details not application layer user details
export async function getMe(
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

    return res.status(200).json({
      status: "ok",
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
}