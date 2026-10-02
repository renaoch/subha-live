import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";
import { CloudflareRealtimeError } from "../lib/media/cloudflare/cloudflare.errors";
import { logger } from "../lib/logger";

/**
 * Central error handler.
 *
 * Security: `details` is only returned for CLIENT errors (4xx), where it
 * carries safe, user-relevant data (e.g. zod field errors). It is DROPPED for
 * server errors (5xx) so raw Postgres/PostgREST/provider messages — table or
 * constraint names, query hints, SDP/credential fragments — never leak to the
 * browser. The full error is still logged server-side for operators.
 */
export const errorMiddleware: ErrorRequestHandler = (
  error,
  req,
  res,
  _next
) => {
  const requestId = req.requestId;

  logger.error("API error", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    errorMessage: error instanceof Error ? error.message : String(error),
    statusCode: error instanceof AppError ? error.statusCode : undefined,
  });

  if (error instanceof AppError) {
    const isServerError = error.statusCode >= 500;
    return res.status(error.statusCode).json({
      status: "error",
      error: {
        code: error.code ?? "APPLICATION_ERROR",
        message: error.message,
        ...(error.details !== undefined && !isServerError
          ? { details: error.details }
          : {}),
      },
    });
  }

  /*
   * CloudflareRealtimeError extends the plain Error class (not AppError). Its
   * message carries a sanitized reason; the raw provider `responseBody` (which
   * can contain SDP offers and other internals) is logged server-side only and
   * never returned to the client.
   */
  if (error instanceof CloudflareRealtimeError) {
    logger.error("Cloudflare media provider error", {
      requestId,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
    });
    return res.status(error.statusCode >= 400 ? error.statusCode : 502).json({
      status: "error",
      error: {
        code: "MEDIA_PROVIDER_ERROR",
        message: error.message,
      },
    });
  }

  return res.status(500).json({
    status: "error",
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong while processing your request.",
    },
  });
};
