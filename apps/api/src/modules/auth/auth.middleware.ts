// deploy/src/modules/auth/auth.middleware.ts
//
// FIX: The old version called `supabase.auth.getUser(token)` on EVERY
// authenticated request — a network round-trip to Supabase's auth server
// on every /join, /media/viewer/session, /media call, adding 100-400ms+
// to every step of the viewer join sequence.
//
// UPDATE: this project has migrated to Supabase's new JWT Signing Keys,
// which sign tokens asymmetrically (ES256) by default. A static HS256
// secret can't verify those tokens, so instead we verify against
// Supabase's JWKS (public key) endpoint. `jose`'s createRemoteJWKSet
// caches the public key in memory after the first fetch, so this is
// STILL zero network calls on every request after the first one — just
// like the HS256 secret approach, but works with the new signing keys.
//
// SETUP REQUIRED:
//   1. npm install jose   (run inside /deploy — you can remove
//      jsonwebtoken / @types/jsonwebtoken if you'd already added them,
//      jose replaces that approach here)
//   2. Make sure SUPABASE_URL is set in your deploy environment (it's
//      already required by deploy/src/lib/supabase.ts, so it should be
//      present already — no new secret to copy for this one).

import { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { AppError } from "../../errors/app-error";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set in environment variables.");
}

const SUPABASE_URL: string = process.env.SUPABASE_URL;

// Built once at startup, reused across every request. `jose` fetches and
// caches Supabase's public signing keys internally and refreshes them in
// the background, so this never hits the network per-request after the
// first call.
const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  aud?: string | string[];
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
      // Local verification against Supabase's public keys — no network
      // call once JWKS is warm.
      const result = await jwtVerify(token, JWKS, {
        audience: "authenticated",
      });
      payload = result.payload as SupabaseJwtPayload;
    } catch (err) {
      // Keep this log until you've confirmed things are stable, then
      // feel free to trim it down.
      console.log("auth verify FAILED:", (err as Error).message);
      console.log(
        `auth (local verify, FAILED): ${(performance.now() - authStart).toFixed(2)}ms`
      );
      throw new AppError(401, "Invalid or expired authentication token", {
        code: "INVALID_OR_EXPIRED_TOKEN",
      });
    }

    console.log(
      `auth.verify (local JWKS): ${(performance.now() - authStart).toFixed(2)}ms`
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

/**
 * Same verification as `authMiddleware`, but never rejects the request.
 * Attaches `req.user` when a valid bearer token is present; otherwise
 * leaves it undefined and continues.
 *
 * For endpoints that must stay public (e.g. viewers reading room task
 * state before they've necessarily authenticated) but want to
 * personalize the response (e.g. "did *this* user already claim the
 * reward") when a token happens to be present.
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  if (!token) return next();

  try {
    const result = await jwtVerify(token, JWKS, { audience: "authenticated" });
    const payload = result.payload as SupabaseJwtPayload;
    if (payload.sub) {
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      } as Request["user"];
    }
  } catch {
    // Invalid/expired token on a public route — just proceed unauthenticated
    // rather than failing the request.
  }

  next();
}