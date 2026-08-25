import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { roomMediaService } from "./room-media.service";

function getTracks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value;
}

export async function getMediaState(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await roomMediaService.getState(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function publishHost(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    const offerSdp = typeof req.body?.offerSdp === "string" ? req.body.offerSdp : "";
    const result = await roomMediaService.publishHost(
      req.params.id,
      req.user.id,
      offerSdp,
      getTracks(req.body?.tracks),
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}


export async function subscribeHostToGuests(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    const offerSdp = typeof req.body?.offerSdp === "string" ? req.body.offerSdp : "";
    const answerSdp = typeof req.body?.answerSdp === "string" ? req.body.answerSdp : undefined;
    const result = await roomMediaService.subscribeHostToGuests(
      req.params.id,
      req.user.id,
      offerSdp,
      answerSdp,
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function publishGuest(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    const offerSdp = typeof req.body?.offerSdp === "string" ? req.body.offerSdp : "";
    const result = await roomMediaService.publishGuest(
      req.params.id,
      req.user.id,
      offerSdp,
      getTracks(req.body?.tracks),
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function unpublishGuest(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    await roomMediaService.unpublishGuest(req.params.id, req.user.id);
    res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}

export async function createViewerSession(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    const offerSdp = typeof req.body?.offerSdp === "string" ? req.body.offerSdp : "";
    const result = await roomMediaService.createViewerSession(
      req.params.id,
      req.user.id,
      offerSdp,
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function completeRenegotiation(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    const answerSdp = typeof req.body?.answerSdp === "string" ? req.body.answerSdp : "";
    if (!answerSdp.trim()) throw new AppError(400, "answerSdp is required", {
      code: "MEDIA_SDP_ANSWER_REQUIRED",
    });

    await roomMediaService.completeRenegotiation(
      req.params.id,
      req.user.id,
      answerSdp,
    );

    res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}

export async function leaveViewer(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    await roomMediaService.leaveViewer(req.params.id, req.user.id);
    res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}

export async function mediaHeartbeat(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });

    const role = req.body?.role;
    if (role !== "host" && role !== "speaker" && role !== "viewer") {
      throw new AppError(400, "role must be host, speaker, or viewer", {
        code: "MEDIA_ROLE_INVALID",
      });
    }

    const sessionId = String(req.body?.sessionId ?? "").trim();
    const generation = Number(req.body?.generation);
    if (!sessionId || !Number.isInteger(generation)) {
      throw new AppError(400, "sessionId and generation are required", {
        code: "MEDIA_HEARTBEAT_INVALID",
      });
    }

    await roomMediaService.heartbeat(
      req.params.id,
      req.user.id,
      role,
      sessionId,
      generation,
    );

    res.json({ success: true, data: { heartbeatAt: Date.now() } });
  } catch (error) {
    next(error);
  }
}
