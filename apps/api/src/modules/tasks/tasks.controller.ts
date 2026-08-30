import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getMyTasks,
  claimTask,
  assertIsPlatformAdmin,
  adminListTasks,
  adminCreateTask,
  adminUpdateTask,
  adminDeleteTask,
} from "./tasks.service";

import {
  taskIdSchema,
  adminCreateTaskSchema,
  adminUpdateTaskSchema,
} from "./tasks.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });
  }
  return req.user;
}

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
// --- Admin (global user-task management) ---

export async function adminListTasksController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);

    const tasks = await adminListTasks();

    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
}

export async function adminCreateTaskController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);

    const result = adminCreateTaskSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, "Invalid task payload", {
        code: "INVALID_TASK_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }

    const task = await adminCreateTask(result.data);

    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateTaskController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);

    const result = adminUpdateTaskSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, "Invalid task payload", {
        code: "INVALID_TASK_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }

    const task = await adminUpdateTask(req.params.id, result.data);

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteTaskController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);

    await adminDeleteTask(req.params.id);

    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}
