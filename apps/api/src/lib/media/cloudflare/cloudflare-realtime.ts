import { mediaConfig } from "../../../config/media.config";

import {
  MediaProviderError,
} from "../../../modules/media/media.errors";

import type {
  MediaProvider,
} from "../../../modules/media/media.provider";

import type {
  CloseTracksInput,
  CreateMediaSessionInput,
  CreateMediaSessionResult,
  MediaNegotiationResult,
  MediaSession,
  MediaSessionInfo,
  MediaTrack,
  PublishTracksInput,
  RemoteMediaTrack,
  RenegotiateInput,
  SubscribeTracksInput,
  UpdateTracksInput,
} from "../../../modules/media/media.types";

import {
  CloudflareRealtimeHttpClient,
} from "./cloudflare.http";

import type {
  CloudflareSessionResponse,
  CloudflareSessionInfo,
  CloudflareTracksResponse,
  CloudflareTrack,
} from "./cloudflare.types";

export class CloudflareRealtimeProvider
  implements MediaProvider
{
  private readonly apiBase:
    | string
    | undefined;

  private readonly appId:
    | string
    | undefined;

  private readonly appSecret:
    | string
    | undefined;

  private readonly http:
    | CloudflareRealtimeHttpClient
    | null;

  constructor() {
    this.apiBase =
      process.env
        .CF_REALTIME_API_BASE;

    this.appId =
      process.env
        .CF_REALTIME_APP_ID;

    this.appSecret =
      process.env
        .CF_REALTIME_APP_SECRET;

    if (
      this.apiBase &&
      this.appId &&
      this.appSecret
    ) {
      this.http =
        new CloudflareRealtimeHttpClient({
          apiBase:
            this.apiBase,

          appId:
            this.appId,

          appSecret:
            this.appSecret,

          timeoutMs:
            12_000,

          maxAttempts:
            mediaConfig.retry
              .maxAttempts,

          baseDelayMs:
            mediaConfig.retry
              .baseDelayMs,

          maxDelayMs:
            mediaConfig.retry
              .maxDelayMs,
        });
    } else {
      this.http = null;
    }
  }

  /* ==========================================================================
   * CONFIGURATION
   * ======================================================================== */

  isConfigured(): boolean {
    return Boolean(
      this.apiBase &&
        this.appId &&
        this.appSecret,
    );
  }

  validateConfiguration(): void {
    if (!this.apiBase) {
      throw new MediaProviderError(
        "CF_REALTIME_API_BASE is not configured",
        {
          missingVariable:
            "CF_REALTIME_API_BASE",
        },
      );
    }

    if (!this.appId) {
      throw new MediaProviderError(
        "CF_REALTIME_APP_ID is not configured",
        {
          missingVariable:
            "CF_REALTIME_APP_ID",
        },
      );
    }

    if (!this.appSecret) {
      throw new MediaProviderError(
        "CF_REALTIME_APP_SECRET is not configured",
        {
          missingVariable:
            "CF_REALTIME_APP_SECRET",
        },
      );
    }
  }

  private getHttp(): CloudflareRealtimeHttpClient {
    this.validateConfiguration();

    if (!this.http) {
      throw new MediaProviderError(
        "Cloudflare Realtime HTTP client is not initialized",
      );
    }

    return this.http;
  }

  /* ==========================================================================
   * SESSION
   * ======================================================================== */

  async createSession(
    input: CreateMediaSessionInput,
  ): Promise<CreateMediaSessionResult> {
    const body: Record<
      string,
      unknown
    > = {};

    /*
     * Cloudflare requires a valid browser-generated
     * SDP offer when creating the session.
     */
    if (input.offerSdp) {
      /*
       * IMPORTANT:
       *
       * Only use .trim() to check for
       * emptiness. Do NOT send the trimmed
       * value to Cloudflare. trim() strips
       * the trailing \r\n that terminates
       * the last SDP line, and Cloudflare's SDP
       * parser requires that terminator.
       */
      if (!input.offerSdp.trim()) {
        throw new MediaProviderError(
          "offerSdp is required. Generate it from a browser RTCPeerConnection before creating the Cloudflare media session.",
          {
            code:
              "MEDIA_SDP_OFFER_REQUIRED",
          },
        );
      }

      body.sessionDescription = {
        type: "offer",
        sdp: input.offerSdp,
      };
    } else {
      throw new MediaProviderError(
        "offerSdp is required. Generate it from a browser RTCPeerConnection before creating the Cloudflare media session.",
        {
          code:
            "MEDIA_SDP_OFFER_REQUIRED",
        },
      );
    }

    const response =
      await this.getHttp().request<CloudflareSessionResponse>(
        "/sessions/new",
        {
          method: "POST",

          body: JSON.stringify(
            body,
          ),
        },
      );

    if (
      !response?.sessionId
    ) {
      throw new MediaProviderError(
        "Cloudflare did not return a session ID",
        {
          response,
        },
      );
    }

    const timestamp =
      Date.now();

    const session: MediaSession = {
      sessionId:
        response.sessionId,

      roomId:
        input.roomId,

      userId:
        input.userId,

      role:
        input.role,

      generation:
        input.generation,

      status:
        "connecting",

      createdAt:
        timestamp,

      lastHeartbeatAt:
        timestamp,
    };

    return {
      session,

      sessionDescription:
        response.sessionDescription,
    };
  }

  /* ==========================================================================
   * PUBLISH TRACKS
   * ======================================================================== */

  async publishTracks(
    input: PublishTracksInput,
  ): Promise<MediaNegotiationResult> {
    if (
      !input.sessionId ||
      !input.sessionId.trim()
    ) {
      throw new MediaProviderError(
        "sessionId is required",
        {
          code:
            "MEDIA_SESSION_ID_REQUIRED",
        },
      );
    }

    if (
      !input.offerSdp ||
      !input.offerSdp.trim()
    ) {
      throw new MediaProviderError(
        "offerSdp is required",
        {
          code:
            "MEDIA_SDP_OFFER_REQUIRED",
        },
      );
    }

    if (
      !Array.isArray(
        input.tracks,
      ) ||
      input.tracks.length === 0
    ) {
      throw new MediaProviderError(
        "At least one track is required",
        {
          code:
            "MEDIA_TRACKS_REQUIRED",
        },
      );
    }

    /*
     * Convert our internal MediaTrack
     * representation into Cloudflare's
     * local-track representation.
     *
     * IMPORTANT:
     *
     * mid comes from the browser's
     * RTCRtpTransceiver and must be sent
     * to Cloudflare.
     */
    const tracks =
      this.mapPublishTracks(
        input.tracks,
      );

    console.log(
      "[cloudflare-realtime] Publishing tracks:",
      tracks.map(
        (track) => ({
          location:
            track.location,

          mid:
            track.mid,

          trackName:
            track.trackName,

          kind:
            track.kind,
        }),
      ),
    );

    /*
     * Keep the exact request body in one object.
     *
     * This lets us log exactly what is being
     * sent to Cloudflare and guarantees the
     * logged payload is the same payload used
     * by the HTTP request.
     */
    const requestBody = {
      sessionDescription: {
        sdp:
          input.offerSdp,

        type: "offer",
      },

      tracks,
    };

    console.log(
      "[cloudflare-realtime] TRACKS/NEW REQUEST",
      {
        sessionId:
          input.sessionId,

        sdpLength:
          input.offerSdp.length,

        tracks,

        bodyLength:
          JSON.stringify(
            requestBody,
          ).length,
      },
    );

    const response =
      await this.getHttp().request<CloudflareTracksResponse>(
        `/sessions/${encodeURIComponent(
          input.sessionId,
        )}/tracks/new`,
        {
          method: "POST",

          body: JSON.stringify(
            requestBody,
          ),
        },
      );

    return {
      answerSdp:
        response.sessionDescription
          ?.type === "answer"
          ? response
              .sessionDescription
              .sdp
          : undefined,

      offerSdp:
        response.sessionDescription
          ?.type === "offer"
          ? response
              .sessionDescription
              .sdp
          : undefined,

      tracks:
        this.mapCloudflareTracks(
          response.tracks ?? [],
        ),

      requiresRenegotiation:
        Boolean(
          response.requiresImmediateRenegotiation,
        ),
    };
  }

  /* ==========================================================================
   * SUBSCRIBE TRACKS
   * ======================================================================== */

  async subscribeTracks(
    input: SubscribeTracksInput,
  ): Promise<MediaNegotiationResult> {
    if (
      !input.sessionId ||
      !input.sessionId.trim()
    ) {
      throw new MediaProviderError(
        "sessionId is required",
      );
    }

    if (
      !Array.isArray(
        input.tracks,
      ) ||
      input.tracks.length === 0
    ) {
      throw new MediaProviderError(
        "At least one track is required",
      );
    }

    const body: Record<
      string,
      unknown
    > = {
      tracks:
        this.mapSubscribeTracks(
          input.tracks,
        ),
    };

    if (
      input.offerSdp &&
      input.offerSdp.trim()
    ) {
      body.sessionDescription = {
        sdp:
          input.offerSdp,

        type: "offer",
      };
    }

    const response =
      await this.getHttp().request<CloudflareTracksResponse>(
        `/sessions/${encodeURIComponent(
          input.sessionId,
        )}/tracks/new`,
        {
          method: "POST",

          body: JSON.stringify(
            body,
          ),
        },
      );

    return {
      answerSdp:
        response.sessionDescription
          ?.type === "answer"
          ? response
              .sessionDescription
              .sdp
          : undefined,

      offerSdp:
        response.sessionDescription
          ?.type === "offer"
          ? response
              .sessionDescription
              .sdp
          : undefined,

      tracks:
        this.mapCloudflareTracks(
          response.tracks ?? [],
        ),

      requiresRenegotiation:
        Boolean(
          response.requiresImmediateRenegotiation,
        ),
    };
  }

  /* ==========================================================================
   * RENEGOTIATION
   * ======================================================================== */

  async renegotiate(
    input: RenegotiateInput,
  ): Promise<void> {
    if (
      !input.sessionId ||
      !input.sessionId.trim()
    ) {
      throw new MediaProviderError(
        "sessionId is required",
      );
    }

    if (
      !input.answerSdp ||
      !input.answerSdp.trim()
    ) {
      throw new MediaProviderError(
        "answerSdp is required",
      );
    }

    await this.getHttp().request(
      `/sessions/${encodeURIComponent(
        input.sessionId,
      )}/renegotiate`,
      {
        method: "PUT",

        body: JSON.stringify({
          sessionDescription: {
            sdp:
              input.answerSdp,

            type: "answer",
          },
        }),
      },
    );
  }

  /* ==========================================================================
   * CLOSE TRACKS
   * ======================================================================== */

  async closeTracks(
    input: CloseTracksInput,
  ): Promise<void> {
    if (
      !input.sessionId ||
      !input.sessionId.trim()
    ) {
      throw new MediaProviderError(
        "sessionId is required",
      );
    }

    if (
      input.trackNames.length ===
      0
    ) {
      return;
    }

    await this.getHttp().request(
      `/sessions/${encodeURIComponent(
        input.sessionId,
      )}/tracks/close`,
      {
        method: "PUT",

        body: JSON.stringify({
          tracks:
            input.trackNames.map(
              (
                trackName,
              ) => ({
                trackName,
              }),
            ),

          force: true,
        }),
      },
    );
  }

  /* ==========================================================================
   * UPDATE TRACKS
   * ======================================================================== */

  async updateTracks(
    input: UpdateTracksInput,
  ): Promise<void> {
    if (
      !input.sessionId ||
      !input.sessionId.trim()
    ) {
      throw new MediaProviderError(
        "sessionId is required",
      );
    }

    const tracks =
      this.mapUpdateTracks(
        input.tracks,
      );

    await this.getHttp().request(
      `/sessions/${encodeURIComponent(
        input.sessionId,
      )}/tracks/update`,
      {
        method: "PUT",

        body: JSON.stringify({
          tracks,
        }),
      },
    );
  }

  /* ==========================================================================
   * GET SESSION
   * ======================================================================== */

  async getSession(
    sessionId: string,
  ): Promise<MediaSessionInfo> {
    if (
      !sessionId ||
      !sessionId.trim()
    ) {
      throw new MediaProviderError(
        "sessionId is required",
      );
    }

    const response =
      await this.getHttp().request<CloudflareSessionInfo>(
        `/sessions/${encodeURIComponent(
          sessionId,
        )}`,
        {
          method: "GET",
        },
      );

    return {
      sessionId:
        response.sessionId ??
        sessionId,

      status:
        this.normalizeStatus(
          response.status,
        ),

      metadata:
        response,
    };
  }

  /* ==========================================================================
   * CLOSE SESSION
   * ======================================================================== */

  async closeSession(
    sessionId: string,
  ): Promise<void> {
    const session =
      await this.getSession(
        sessionId,
      );

    const tracks =
      session.metadata
        ?.tracks;

    const trackNames =
      Array.isArray(tracks)
        ? tracks
            .map(
              (
                track,
              ) => {
                if (
                  typeof track !==
                    "object" ||
                  track === null
                ) {
                  return undefined;
                }

                const value =
                  track as {
                    trackName?: unknown;
                  };

                return typeof value.trackName ===
                  "string"
                  ? value.trackName
                  : undefined;
              },
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            )
        : [];

    if (
      trackNames.length > 0
    ) {
      await this.closeTracks({
        sessionId,

        trackNames,
      });
    }
  }

  /* ==========================================================================
   * TRACK MAPPING
   * ======================================================================== */

  private mapCloudflareTracks(
    tracks: CloudflareTrack[],
  ): MediaTrack[] {
    return tracks.map(
      (
        track,
      ): MediaTrack => {
        const direction =
          track.location ===
          "local"
            ? "publish"
            : "subscribe";

        return {
          trackName:
            track.trackName,

          kind:
            this.getTrackKind(
              track.trackName,
            ),

          direction,

          /*
           * Preserve Cloudflare's MID
           * when it returns one.
           */
          mid:
            track.mid,
        };
      },
    );
  }

  /*
   * Convert our application track
   * into Cloudflare's local track.
   *
   * BEFORE:
   *
   * {
   *   location: "local",
   *   trackName: "..."
   * }
   *
   * AFTER:
   *
   * {
   *   location: "local",
   *   mid: "0",
   *   trackName: "...",
   *   kind: "video"
   * }
   */
  private mapPublishTracks(
    tracks: MediaTrack[],
  ): Array<{
    location: "local";

    mid: string;

    trackName: string;

    kind:
      | "audio"
      | "video";
  }> {
    return tracks.map(
      (
        track,
        index,
      ) => {
        const trackName =
          String(
            track.trackName ??
              "",
          ).trim();

        if (!trackName) {
          throw new MediaProviderError(
            `Track ${index} is missing trackName`,
            {
              code:
                "MEDIA_TRACK_NAME_REQUIRED",

              trackIndex:
                index,
            },
          );
        }

        const mid =
          typeof track.mid ===
          "string"
            ? track.mid.trim()
            : "";

        if (!mid) {
          throw new MediaProviderError(
            `Track "${trackName}" is missing mid`,
            {
              code:
                "MEDIA_TRACK_MID_REQUIRED",

              trackIndex:
                index,

              trackName,
            },
          );
        }

        if (
          track.direction !==
          "publish"
        ) {
          throw new MediaProviderError(
            `Track "${trackName}" must have direction "publish"`,
            {
              code:
                "MEDIA_TRACK_DIRECTION_INVALID",

              trackIndex:
                index,

              trackName,

              direction:
                track.direction,
            },
          );
        }

        const kind =
          track.kind ===
          "video"
            ? "video"
            : "audio";

        return {
          location:
            "local",

          mid,

          trackName,

          kind,
        };
      },
    );
  }

  private mapSubscribeTracks(
    tracks: RemoteMediaTrack[],
  ): Array<{
    location: "remote";

    sessionId: string;

    trackName: string;
  }> {
    return tracks.map(
      (
        track,
        index,
      ) => {
        const sessionId =
          String(
            track.sessionId ??
              "",
          ).trim();

        const trackName =
          String(
            track.trackName ??
              "",
          ).trim();

        if (!sessionId) {
          throw new MediaProviderError(
            `Remote track ${index} is missing sessionId`,
            {
              code:
                "MEDIA_REMOTE_TRACK_SESSION_ID_REQUIRED",

              trackIndex:
                index,

              trackName,
            },
          );
        }

        if (!trackName) {
          throw new MediaProviderError(
            `Remote track ${index} is missing trackName`,
            {
              code:
                "MEDIA_REMOTE_TRACK_NAME_REQUIRED",

              trackIndex:
                index,

              sessionId,
            },
          );
        }

        return {
          location:
            "remote",

          sessionId,

          trackName,
        };
      },
    );
  }

  private mapUpdateTracks(
    tracks: MediaTrack[],
  ): Array<{
    trackName: string;

    mid?: string;

    kind?:
      | "audio"
      | "video";
  }> {
    return tracks.map(
      (
        track,
        index,
      ) => {
        const trackName =
          String(
            track.trackName ??
              "",
          ).trim();

        if (!trackName) {
          throw new MediaProviderError(
            `Track ${index} is missing trackName`,
            {
              code:
                "MEDIA_TRACK_NAME_REQUIRED",

              trackIndex:
                index,
            },
          );
        }

        return {
          trackName,

          mid:
            track.mid,

          kind:
            track.kind,
        };
      },
    );
  }

  /* ==========================================================================
   * TRACK KIND
   * ======================================================================== */

  private getTrackKind(
    trackName: string,
  ):
    | "audio"
    | "video" {
    const normalized =
      trackName.toLowerCase();

    if (
      normalized.includes(
        "video",
      )
    ) {
      return "video";
    }

    if (
      normalized.includes(
        "audio",
      )
    ) {
      return "audio";
    }

    /*
     * Your frontend creates names
     * such as:
     *
     * phase1-video-...
     * phase1-audio-...
     *
     * so this should normally
     * resolve correctly.
     */
    throw new MediaProviderError(
      `Unable to determine media track kind for track "${trackName}"`,
      {
        trackName,
      },
    );
  }

  /* ==========================================================================
   * STATUS
   * ======================================================================== */

  private normalizeStatus(
    status:
      | string
      | undefined,
  ):
    | MediaSession["status"]
    | "unknown" {
    switch (status) {
      case "creating":
      case "connecting":
      case "connected":
      case "reconnecting":
      case "closing":
      case "closed":
      case "failed":
        return status;

      default:
        return "unknown";
    }
  }

  /* ==========================================================================
   * CONFIGURATION
   * ======================================================================== */

  getConfiguration() {
    return {
      configured:
        this.isConfigured(),

      apiBase:
        this.apiBase,

      appId:
        this.appId
          ? `${this.appId.slice(
              0,
              6,
            )}...`
          : undefined,

      video:
        mediaConfig.video,

      audio:
        mediaConfig.audio,
    };
  }
}

export const cloudflareRealtimeProvider =
  new CloudflareRealtimeProvider();