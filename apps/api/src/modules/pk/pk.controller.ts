import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { pkService } from "./pk.service";
import { pkInviteSchema, pkBattleIdSchema } from "./pk.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

function battleId(req: Request<{ battleId: string }>): string {
  const parsed = pkBattleIdSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError(400, "Invalid battle id", { code: "INVALID_PK_BATTLE_ID" });
  }
  return parsed.data.battleId;
}

export async function listActivePk(_req: Request, res: Response, next: NextFunction) {
  try {
    const battles = await pkService.listActive();
    res.status(200).json({ success: true, data: battles });
  } catch (error) {
    next(error);
  }
}

export async function invitePk(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const input = pkInviteSchema.safeParse(req.body);
    if (!input.success) {
      throw new AppError(400, "Invalid invite payload", {
        code: "INVALID_PK_INVITE",
        details: input.error.flatten().fieldErrors,
      });
    }
    const battle = await pkService.invite(input.data.roomId, input.data.opponentHostId, user.id);
    res.status(201).json({ success: true, data: battle });
  } catch (error) {
    next(error);
  }
}

export async function acceptPk(req: Request<{ battleId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const battle = await pkService.accept(battleId(req), user.id);
    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    next(error);
  }
}

export async function declinePk(req: Request<{ battleId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const battle = await pkService.decline(battleId(req), user.id);
    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    next(error);
  }
}

export async function startPk(req: Request<{ battleId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const battle = await pkService.start(battleId(req), user.id);
    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    next(error);
  }
}

export async function cancelPk(req: Request<{ battleId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const battle = await pkService.cancel(battleId(req), user.id);
    res.status(200).json({ success: true, data: battle });
  } catch (error) {
    next(error);
  }
}

export async function getPk(req: Request<{ battleId: string }>, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const state = await pkService.getState(battleId(req));
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function getPkForRoom(req: Request<{ roomId: string }>, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const state = await pkService.getForRoom(req.params.roomId);
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function getPkHistory(req: Request<{ hostId: string }>, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const history = await pkService.getHistory(req.params.hostId, limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getLastPk(req: Request<{ hostId: string }>, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const last = await pkService.getLastForHost(req.params.hostId);
    res.status(200).json({ success: true, data: last });
  } catch (error) {
    next(error);
  }
}

export async function getPkStats(req: Request<{ hostId: string }>, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const stats = await pkService.getStats(req.params.hostId);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}
