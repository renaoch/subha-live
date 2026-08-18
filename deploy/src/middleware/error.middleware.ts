import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";

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

  return res.status(500).json({
    status: "error",
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong while processing your request.",
    },
  });
};