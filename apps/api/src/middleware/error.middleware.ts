import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";
import { CloudflareRealtimeError } from "../lib/media/cloudflare/cloudflare.errors";

export const errorMiddleware: ErrorRequestHandler = (
  error,
  req,
  res,
  _next
) => {
  console.error("API Error:", {
    method: req.method,
    path: req.originalUrl,
    error,
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: "error",
      error: {
        code: error.code ?? "APPLICATION_ERROR",
        message: error.message,
        ...(error.details !== undefined
          ? { details: error.details }
          : {}),
      },
    });
  }

  /*
   * CloudflareRealtimeError extends the plain Error class
   * (not AppError), so without this branch it was falling
   * through to the generic 500 below and hiding the real
   * Cloudflare Calls failure reason (bad credentials,
   * rejected SDP, rate limiting, network errors, etc.)
   */
  if (error instanceof CloudflareRealtimeError) {
    return res.status(error.statusCode >= 400 ? error.statusCode : 502).json({
      status: "error",
      error: {
        code: "MEDIA_PROVIDER_ERROR",
        message: error.message,
        ...(error.responseBody !== undefined
          ? { details: error.responseBody }
          : {}),
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