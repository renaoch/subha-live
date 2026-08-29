import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { hostTaskService } from "./host-task.service";
import { createHostTaskSchema, heartbeatSchema, setStatusSchema, updateHostTaskSchema } from "./host-task.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getActiveRoomTask(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const task = await hostTaskService.getActiveTaskForViewer(req.params.id, req.user?.id ?? null);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function listRoomTasks(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const tasks = await hostTaskService.listForRoom(req.params.id, user.id);
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
}

export async function createRoomTask(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = createHostTaskSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, "Invalid task payload", {
        code: "INVALID_HOST_TASK_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }
    const task = await hostTaskService.createTask(req.params.id, user.id, result.data);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function updateRoomTask(req: Request<{ taskId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = updateHostTaskSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, "Invalid task payload", {
        code: "INVALID_HOST_TASK_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }
    const task = await hostTaskService.updateTask(req.params.taskId, user.id, result.data);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function deleteRoomTask(req: Request<{ taskId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await hostTaskService.deleteTask(req.params.taskId, user.id);
    res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}

export async function setRoomTaskStatus(req: Request<{ taskId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = setStatusSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, "Invalid status payload", {
        code: "INVALID_HOST_TASK_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }
    const task = await hostTaskService.setStatus(req.params.taskId, user.id, result.data.status);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

export async function claimRoomTask(req: Request<{ taskId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await hostTaskService.claim(req.params.taskId, user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function sendRoomHeartbeat(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = heartbeatSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, "Invalid heartbeat payload", {
        code: "INVALID_HEARTBEAT_PAYLOAD",
        details: result.error.flatten().fieldErrors,
      });
    }
    await hostTaskService.recordHeartbeat(req.params.id, user.id, result.data.seconds / 3600);
    res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}

// --- Admin (global, cross-room) ---

export async function adminListAllTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await hostTaskService.assertIsPlatformAdmin(user.id);
    const tasks = await hostTaskService.listAll();
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
}