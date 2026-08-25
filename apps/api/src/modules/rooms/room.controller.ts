import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { roomService } from "./room.service";


export async function listRooms(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rooms = await roomService.listRooms();

    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
}

export async function createRoom(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const room = await roomService.createRoom({
      ...req.body,
      host_id: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRoom(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const room = await roomService.getRoomById(req.params.id);

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
}

export async function startRoom(
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

    const room = await roomService.startRoom(
      req.params.id,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
}

export async function endRoom(
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

    const room = await roomService.endRoom(
      req.params.id,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
}