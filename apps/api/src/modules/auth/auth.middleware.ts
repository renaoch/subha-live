import { Request, Response, NextFunction } from "express";
import { supabase } from "../../lib/supabase";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    // Authorization header is required
    if (!authHeader) {
      return res.status(401).json({
        status: "error",
        message: "Authorization required",
      });
    }

    // Authorization header must use Bearer scheme
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Invalid authorization header format",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication token is missing",
      });
    }

    // Supabase verifies the access token and returns the authenticated user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired authentication token",
      });
    }

    // Attach authenticated Supabase user to request
    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    return res.status(500).json({
      status: "error",
      message: "Authentication service unavailable",
    });
  }
}