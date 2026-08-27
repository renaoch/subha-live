import { MediaProviderError } from "../../../modules/media/media.errors";

/*
 * Cloudflare's Realtime TURN service is a SEPARATE product from the
 * Realtime SFU (Cloudflare Calls) used elsewhere in this file tree.
 * It has its own credentials — a "Turn Key ID" and "Turn Key API
 * Token" — generated from the Cloudflare dashboard under
 * Realtime > TURN Service, NOT the CF_REALTIME_APP_ID/SECRET pair
 * used for /sessions/new etc.
 *
 * STUN alone only helps a client discover its public address; it
 * does nothing for clients behind a NAT/firewall that blocks direct
 * UDP paths (common on corporate networks, some mobile carriers, and
 * some VPNs). Without a TURN relay as a fallback, ICE negotiation for
 * those clients fails outright — this is what was causing:
 *
 *   "Viewer PeerConnection failed. connectionState=failed,
 *    iceConnectionState=disconnected"
 *
 * for guests trying to publish their mic (and would eventually bite
 * hosts/viewers too, since all three peer connections previously
 * only had a STUN server configured).
 *
 * Docs: https://developers.cloudflare.com/realtime/turn/
 */

const TURN_CREDENTIAL_ENDPOINT =
  "https://rtc.live.cloudflare.com/v1/turn/keys";

export interface TurnIceServer {
  urls: string[];
  username: string;
  credential: string;
}

interface CloudflareTurnCredentialResponse {
  iceServers?: {
    urls?: string[];
    username?: string;
    credential?: string;
  };
}

export class CloudflareTurnProvider {
  private readonly turnKeyId: string | undefined;
  private readonly turnKeyApiToken: string | undefined;
  private readonly ttlSeconds: number;

  constructor() {
    this.turnKeyId = process.env.CF_TURN_KEY_ID;
    this.turnKeyApiToken = process.env.CF_TURN_KEY_API_TOKEN;
    this.ttlSeconds = Number(process.env.CF_TURN_TTL_SECONDS ?? 3600);
  }

  isConfigured(): boolean {
    return Boolean(this.turnKeyId && this.turnKeyApiToken);
  }

  /*
   * Requests short-lived TURN credentials scoped to this one
   * negotiation. These must never be generated on the client or
   * cached long-term — they're meant to be fetched per session and
   * expire on their own (default: 1 hour).
   */
  async generateCredentials(): Promise<TurnIceServer> {
    if (!this.turnKeyId || !this.turnKeyApiToken) {
      throw new MediaProviderError(
        "Cloudflare TURN service is not configured",
        {
          missingVariables: ["CF_TURN_KEY_ID", "CF_TURN_KEY_API_TOKEN"],
        },
      );
    }

    const response = await fetch(
      `${TURN_CREDENTIAL_ENDPOINT}/${encodeURIComponent(this.turnKeyId)}/credentials/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.turnKeyApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: this.ttlSeconds }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new MediaProviderError(
        `Cloudflare TURN credential request failed with HTTP ${response.status}`,
        { statusCode: response.status, body: bodyText },
      );
    }

    const data = (await response.json()) as CloudflareTurnCredentialResponse;

    if (
      !data.iceServers?.urls?.length ||
      !data.iceServers.username ||
      !data.iceServers.credential
    ) {
      throw new MediaProviderError(
        "Cloudflare did not return valid TURN credentials",
        { response: data },
      );
    }

    return {
      urls: data.iceServers.urls,
      username: data.iceServers.username,
      credential: data.iceServers.credential,
    };
  }
}

export const cloudflareTurnProvider = new CloudflareTurnProvider();