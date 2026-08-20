import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyTasks,
  claimTask,
} from "./tasks.service";

import {
  taskIdSchema,
} from "./tasks.schema";

export async function getMyTasksController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const result =
      await getMyTasks(
        req.user.id,
      );

    return res.status(200).json({
      status: "ok",
      tasks: result.tasks,
    });
  } catch (error) {
    next(error);
  }
}

export async function claimTaskController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const result =
      taskIdSchema.safeParse(
        req.params,
      );

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid task ID",
        {
          code: "INVALID_TASK_ID",
          details:
            result.error.flatten()
              .fieldErrors,
        },
      );
    }

    const task =
      await claimTask(
        req.user.id,
        result.data.id,
      );

    return res.status(200).json({
      status: "ok",
      task,
    });
  } catch (error) {
    next(error);
  }
}