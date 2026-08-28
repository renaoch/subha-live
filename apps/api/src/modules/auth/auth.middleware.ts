// deploy/src/modules/auth/auth.middleware.ts
//
// FIX: The old version called `supabase.auth.getUser(token)` on EVERY
// authenticated request. That is a network round-trip to Supabase's auth
// server, on top of your own network hop from the client. It runs on
// /join, /media/viewer/session, /media, literally everything — so it was
// adding 100-400ms+ (more on slow networks) to every single step of the
// viewer join sequence, compounding fast.
//
// FIX: Supabase access tokens are just signed JWTs. We can verify the
// signature + expiry locally, instantly, with zero network calls. This is
// Supabase's own recommended pattern for high-traffic backends.
//
// SETUP REQUIRED:
//   1. npm install jsonwebtoken @types/jsonwebtoken   (run inside /deploy)
//   2. In Supabase dashboard: Project Settings -> API -> JWT Settings
//      copy the "JWT Secret" (legacy HS256 projects) and set it as
//      SUPABASE_JWT_SECRET in your deploy environment (.env / hosting secrets).
//      If your project uses the newer asymmetric (ES256/JWKS) signing keys
//      instead of a legacy HS256 secret, tell me and I'll give you the
//      jose/JWKS version instead — the approach is the same, just the
//      verify call differs.

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../../errors/app-error";

if (!process.env.SUPABASE_JWT_SECRET) {
  throw new Error(
    "SUPABASE_JWT_SECRET must be set in environment variables (Supabase dashboard -> Project Settings -> API -> JWT Settings)."
  );
}

// Re-assigned to a `string`-typed const so TypeScript doesn't lose the
// above null-check when this is read later inside authMiddleware().
const SUPABASE_JWT_SECRET: string = process.env.SUPABASE_JWT_SECRET;

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
  [key: string]: unknown;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError(401, "Authorization required", {
        code: "AUTHORIZATION_REQUIRED",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Invalid authorization header format", {
        code: "INVALID_AUTHORIZATION_HEADER",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      throw new AppError(401, "Authentication token is missing", {
        code: "AUTHENTICATION_TOKEN_MISSING",
      });
    }

    const authStart = performance.now();

    let payload: SupabaseJwtPayload;

    try {
      // Local, synchronous verification — no network call.
      payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
        algorithms: ["HS256"],
      }) as SupabaseJwtPayload;
    } catch (err) {
      console.log(
        `auth (local verify, FAILED): ${(performance.now() - authStart).toFixed(2)}ms`
      );
      throw new AppError(401, "Invalid or expired authentication token", {
        code: "INVALID_OR_EXPIRED_TOKEN",
      });
    }

    console.log(
      `auth.verify (local): ${(performance.now() - authStart).toFixed(2)}ms`
    );

    if (!payload.sub) {
      throw new AppError(401, "Invalid or expired authentication token", {
        code: "INVALID_OR_EXPIRED_TOKEN",
      });
    }

    // Attach a user object shaped like what the rest of the app expects
    // (req.user.id, req.user.email, ...). Adjust the fields below if your
    // downstream code reads other properties off req.user.
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    } as Request["user"];

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    next(error);
  }
}