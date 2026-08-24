import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { getOrSetCache } from "../../lib/redis";

// How long a verified token stays cached before we re-check with
// Supabase. Keep this short — it trades a little revocation
// freshness for cutting a ~150-300ms+ network round trip on every
// single request.
const AUTH_CACHE_TTL_SECONDS = 60;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError(
        401,
        "Authorization required",
        {
          code: "AUTHORIZATION_REQUIRED",
        }
      );
    }

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

    const authStart = performance.now();

    const cacheKey = `auth:user:${hashToken(token)}`;

    const user = await getOrSetCache(
      cacheKey,
      AUTH_CACHE_TTL_SECONDS,
      async () => {
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
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

        return data.user;
      },
    );

    console.log(
      `auth.getUser (cache-aside): ${(performance.now() - authStart).toFixed(2)}ms`
    );

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    next(error);
  }
}