import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  cloudflareRealtimeProvider,
} from "../../lib/media/cloudflare/cloudflare-realtime";

/**
 * GET /api/v1/media/test/config
 */
export async function testCloudflareConfig(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({
      status: "ok",
      data: {
        provider:
          "cloudflare-realtime",

        configured:
          cloudflareRealtimeProvider.isConfigured(),

        configuration:
          cloudflareRealtimeProvider.getConfiguration(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/media/test/session
 *
 * Creates a Cloudflare session.
 *
 * Body:
 * {
 *   "roomId": "phase1-test-room"
 * }
 */
export async function testCreateSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId =
      (req as any).user?.id ??
      "phase1-test-user";

    const roomId =
      String(
        req.body?.roomId ??
          "phase1-test-room",
      );

    const result =
      await cloudflareRealtimeProvider.createSession({
        roomId,
        userId,
        role: "viewer",
        generation: 1,
      });

    res.status(201).json({
      status: "ok",

      data: {
        sessionId:
          result.session.sessionId,

        roomId:
          result.session.roomId,

        userId:
          result.session.userId,

        role:
          result.session.role,

        generation:
          result.session.generation,

        status:
          result.session.status,

        sessionDescription:
          result.sessionDescription,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/media/test/tracks
 *
 * Adds tracks to a Cloudflare session.
 *
 * Body:
 * {
 *   "sessionId": "...",
 *   "offerSdp": "...",
 *   "tracks": [
 *     {
 *       "trackName": "test-video",
 *       "kind": "video",
 *       "direction": "publish"
 *     },
 *     {
 *       "trackName": "test-audio",
 *       "kind": "audio",
 *       "direction": "publish"
 *     }
 *   ]
 * }
 */
export async function testPublishTracks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId =
      String(
        req.body?.sessionId ?? "",
      ).trim();

    const offerSdp =
      typeof req.body?.offerSdp ===
      "string"
        ? req.body.offerSdp.trim()
        : "";

    if (!sessionId) {
      res.status(400).json({
        status: "error",

        error: {
          code:
            "MEDIA_SESSION_ID_REQUIRED",

          message:
            "sessionId is required.",
        },
      });

      return;
    }

    if (!offerSdp) {
      res.status(400).json({
        status: "error",

        error: {
          code:
            "MEDIA_SDP_OFFER_REQUIRED",

          message:
            "offerSdp is required.",
        },
      });

      return;
    }

    const tracks =
      Array.isArray(
        req.body?.tracks,
      )
        ? req.body.tracks
        : [];

    const result =
      await cloudflareRealtimeProvider.publishTracks({
        sessionId,
        offerSdp,
        tracks,
      });

    res.json({
      status: "ok",

      data: {
        answerSdp:
          result.answerSdp,

        offerSdp:
          result.offerSdp,

        tracks:
          result.tracks,

        requiresRenegotiation:
          result.requiresRenegotiation,
      },
    });
  } catch (error) {
    next(error);
  }
}