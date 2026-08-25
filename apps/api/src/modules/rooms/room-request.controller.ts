import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { roomRequestService } from "./room-request.service";

type RequestType = "audio" | "video";

function getType(value: unknown): RequestType {
  return value === "video" ? "video" : "audio";
}

export async function createSpeakerRequest(
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

    const targetUserId = String(req.body?.userId ?? req.user.id).trim();
    const type = getType(req.body?.type);

    const request = await roomRequestService.createSpeakerRequest({
      roomId: req.params.id,
      requesterId: req.user.id,
      targetUserId,
      type,
    });

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelSpeakerRequest(
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

    await roomRequestService.cancelSpeakerRequest(
      req.params.id,
      req.user.id,
      getType(req.query.type),
    );

    res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function listSpeakerRequests(
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

    const requests = await roomRequestService.listPendingRequests(
      req.params.id,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveSpeakerRequest(
  req: Request<{ id: string; requestId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const request = await roomRequestService.respondToRequest(
      req.params.id,
      req.params.requestId,
      req.user.id,
      "approve",
    );

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectSpeakerRequest(
  req: Request<{ id: string; requestId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const request = await roomRequestService.respondToRequest(
      req.params.id,
      req.params.requestId,
      req.user.id,
      "reject",
    );

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptHostInvitation(
  req: Request<{ id: string; requestId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const request = await roomRequestService.acceptHostInvitation(
      req.params.id,
      req.params.requestId,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeSpeaker(
  req: Request<{ id: string; userId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    await roomRequestService.removeSpeaker(
      req.params.id,
      req.params.userId,
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

// Backward-compatible names for the existing audio-request frontend.
export const createAudioRequest = createSpeakerRequest;
export const cancelAudioRequest = cancelSpeakerRequest;
