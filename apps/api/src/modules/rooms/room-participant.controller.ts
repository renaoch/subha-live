import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { roomParticipantService } from "./room-participant.service";

export async function joinRoom(
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

    const participant = await roomParticipantService.joinRoom({
      room_id: req.params.id,
      user_id: req.user.id,
      role: "audience",
    });

    res.status(200).json({
      success: true,
      data: participant,
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveRoom(
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

    await roomParticipantService.leaveRoom(
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