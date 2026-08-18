import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { roomRequestService } from "./room-request.service";

export async function createAudioRequest(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const request = await roomRequestService.createAudioRequest({
      room_id: req.params.id,
      user_id: req.user.id,
      type: "audio",
    });

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelAudioRequest(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    await roomRequestService.cancelAudioRequest(
      req.params.id,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
}