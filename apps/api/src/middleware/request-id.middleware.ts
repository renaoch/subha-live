import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

/**
 * A request id is either a valid, sanitized incoming value or a freshly
 * generated UUID. We only reuse an incoming id when it matches a conservative
 * charset (alphanumeric + hyphen, 8–128 chars) so a caller can't inject
 * control characters, log-forging sequences, or unbounded strings into our
 * logs / downstream systems.
 */
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming =
    req.header("x-request-id") ?? req.header("x-correlation-id");

  const requestId =
    incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}
