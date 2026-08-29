import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { roomTaskService } from "./room-task.service";
import { setRoomTaskSchema } from "./room-task.schema";

export async function getRoomTask(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const task = await roomTaskService.getActiveTask(req.params.id);

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function setRoomTask(
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

    const result = setRoomTaskSchema.safeParse(req.body);

    if (!result.success) {
      throw new AppError(400, "Invalid task payload", {
        code: "INVALID_ROOM_TASK_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }

    const task = await roomTaskService.setTask(
      req.params.id,
      req.user.id,
      result.data,
    );

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function claimRoomTask(
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

    const task = await roomTaskService.getActiveTask(req.params.id, req.user.id);

    if (!task) {
      throw new AppError(404, "Task not found", { code: "ROOM_TASK_NOT_FOUND" });
    }

    const result = await roomTaskService.claimReward(task.id, req.user.id);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function cancelRoomTask(
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

    await roomTaskService.cancelTask(req.params.id, req.user.id);

    res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}
