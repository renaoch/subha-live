import { Request, Response, NextFunction } from "express";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    // Authorization header is required
    if (!authHeader) {
      throw new AppError(
        401,
        "Authorization required",
        {
          code: "AUTHORIZATION_REQUIRED",
        }
      );
    }

    // Authorization header must use Bearer scheme
    if (!authHeader.startsWith("Bearer ")) {
      throw new AppError(
        401,
        "Invalid authorization header format",
        {
          code: "INVALID_AUTHORIZATION_HEADER",
        }
      );
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      throw new AppError(
        401,
        "Authentication token is missing",
        {
          code: "AUTHENTICATION_TOKEN_MISSING",
        }
      );
    }

    // Supabase verifies the access token and returns the authenticated user
    const authStart = performance.now();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    console.log(
      `auth.getUser: ${(performance.now() - authStart).toFixed(2)}ms`
    );

if (error || !user) {
  console.error("Supabase auth.getUser error:", {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
  });

  throw new AppError(
    401,
    "Invalid or expired authentication token",
    {
      code: "INVALID_OR_EXPIRED_TOKEN",
    }
  );
}

    // Attach authenticated Supabase user to request
    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    next(error);
  }
}