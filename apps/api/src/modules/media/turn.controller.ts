import type { Request, Response, NextFunction } from "express";

import { cloudflareTurnProvider } from "../../lib/media/cloudflare/cloudflare-turn";

/**
 * GET /api/v1/media/turn-credentials
 *
 * Returns short-lived TURN credentials for the current user to add
 * to their RTCPeerConnection's iceServers, alongside the existing
 * STUN server. Required so host/viewer/guest publishing and
 * subscribing still works on networks that block direct UDP paths
 * (STUN alone can't help there).
 *
 * Any authenticated user may call this — it's not room-scoped since
 * the credentials themselves don't grant access to anything beyond
 * relaying already-negotiated media.
 */
export async function getTurnCredentials(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!cloudflareTurnProvider.isConfigured()) {
      res.json({
        success: true,
        data: { iceServers: [] },
      });
      return;
    }

    const credentials = await cloudflareTurnProvider.generateCredentials();

    res.json({
      success: true,
      data: {
        iceServers: [
          {
            urls: credentials.urls,
            username: credentials.username,
            credential: credentials.credential,
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
}