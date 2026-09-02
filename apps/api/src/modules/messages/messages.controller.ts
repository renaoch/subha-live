import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { messagesService } from "./messages.service";
import { userIdParamSchema, sendMessageSchema } from "./messages.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

function otherId(req: Request<{ userId: string }>): string {
  const parsed = userIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError(400, "Invalid user id", { code: "INVALID_USER_ID" });
  }
  return parsed.data.userId;
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const conversations = await messagesService.listConversations(user.id);
    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
}

export async function getFriendship(req: Request<{ userId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const friendship = await messagesService.friendship(user.id, otherId(req));
    res.status(200).json({ success: true, data: friendship });
  } catch (error) {
    next(error);
  }
}

export async function getThread(req: Request<{ userId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await messagesService.getThread(user.id, otherId(req), {
      before,
      limit: Number.isFinite(limit) && limit ? limit : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function markThreadRead(req: Request<{ userId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await messagesService.markThreadRead(user.id, otherId(req));
    res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: Request<{ userId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid message", {
        code: "INVALID_MESSAGE",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const message = await messagesService.sendMessage(user.id, otherId(req), parsed.data.content);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
}
