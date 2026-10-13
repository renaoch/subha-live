import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../errors/app-error";
import { roomModerationService } from "./room-moderation.service";

const bodySchema = z.object({ userId: z.string().uuid() });
const idSchema = z.string().uuid();

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  return req.user;
}

function parseTarget(req: Request): string {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "userId (uuid) is required", { code: "ROOM_MODERATION_INVALID_BODY" });
  }
  return parsed.data.userId;
}

function parseParam(value: unknown): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new AppError(400, "Invalid user id", { code: "ROOM_MODERATION_INVALID_BODY" });
  return parsed.data;
}

type Action = (roomId: string, hostId: string, targetId: string) => Promise<void>;

function bodyAction(action: Action) {
  return async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      await action(req.params.id, user.id, parseTarget(req));
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
}

function paramAction(action: Action) {
  return async (req: Request<{ id: string; userId: string }>, res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      await action(req.params.id, user.id, parseParam(req.params.userId));
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
}

export const blockUser = bodyAction(roomModerationService.block);
export const unblockUser = paramAction(roomModerationService.unblock);
export const muteUser = bodyAction(roomModerationService.mute);
export const unmuteUser = paramAction(roomModerationService.unmute);
export const kickSpeaker = bodyAction(roomModerationService.kickSpeaker);
export const kickFromRoom = bodyAction(roomModerationService.kick);
export const muteMic = bodyAction(roomModerationService.muteMic);
export const unmuteMic = paramAction(roomModerationService.unmuteMic);

export async function listModeration(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    res.json({ success: true, data: await roomModerationService.list(req.params.id, user.id) });
  } catch (error) {
    next(error);
  }
}

export async function myModeration(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    res.json({ success: true, data: await roomModerationService.me(req.params.id, user.id) });
  } catch (error) {
    next(error);
  }
}

/** DELETE /:id/speakers/:userId — kept for the existing client call. */
export const kickSpeakerParam = paramAction(roomModerationService.kickSpeaker);
