import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { mediaService } from "../media";
import { roomState } from "./room-state.service";
import type {
  MediaSession,
  MediaTrack,
  RemoteMediaTrack,
} from "../media/media.types";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireTrack(
  tracks: MediaTrack[],
  kind: "audio" | "video",
): MediaTrack {
  const track = tracks.find(
    (item) => item.kind === kind,
  );

  if (!track) {
    throw new AppError(
      400,
      `A ${kind} track is required`,
      {
        code: `MEDIA_${kind.toUpperCase()}_TRACK_REQUIRED`,
      },
    );
  }

  return track;
}

async function getRoom(
  roomId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("rooms")
    .select(
      "id, host_id, status, max_guest_slots",
    )
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      500,
      "Failed to fetch room",
      {
        code: "ROOM_FETCH_FAILED",
        details: error.message,
      },
    );
  }

  if (!data) {
    throw new AppError(
      404,
      "Room not found",
      {
        code: "ROOM_NOT_FOUND",
      },
    );
  }

  /*
   * Media operations are only valid while the
   * room is actually live.
   *
   * This is especially important for viewers:
   * the host can end the room between the viewer's
   * initial room fetch and the viewer's Cloudflare
   * session creation request.
   */
  if (data.status !== "live") {
    throw new AppError(
      409,
      "Room is not live",
      {
        code: "ROOM_NOT_LIVE",
      },
    );
  }

  return data;
}

export const roomMediaService = {
  async getState(
    roomId: string,
  ) {
    return mediaService.getRoomState(
      roomId,
    );
  },

  async publishHost(
    roomId: string,
    userId: string,
    offerSdp: string,
    tracks: MediaTrack[],
  ) {
    const room =
      await getRoom(roomId);

    if (
      room.host_id !== userId
    ) {
      throw new AppError(
        403,
        "Only the room host can publish",
        {
          code:
            "ROOM_HOST_REQUIRED",
        },
      );
    }

    if (
      !stringValue(offerSdp)
    ) {
      throw new AppError(
        400,
        "offerSdp is required",
        {
          code:
            "MEDIA_SDP_OFFER_REQUIRED",
        },
      );
    }

    const audioTrack =
      requireTrack(
        tracks,
        "audio",
      );

    const videoTrack =
      requireTrack(
        tracks,
        "video",
      );

    const state =
      await mediaService.getRoomState(
        roomId,
      );

    const generation =
      state.generation;

    const provider =
      await mediaService.getProvider();

    /*
     * Cloudflare Realtime uses one WebRTC PeerConnection
     * per session. The first request to this endpoint creates
     * that session and returns Cloudflare's SDP answer to the
     * browser. The browser applies that answer, waits until
     * the PeerConnection is connected, creates a second SDP
     * offer, and calls this endpoint again.
     *
     * On that second request we reuse the pending host session
     * instead of creating another Cloudflare session.
     */
    let session: MediaSession | null = null;
    const pendingHost =
      state.host &&
      state.host.userId === userId &&
      state.host.generation === generation &&
      state.host.status === "connecting"
        ? state.host
        : null;

    if (pendingHost) {
      session = {
        sessionId:
          pendingHost.sessionId,
        roomId,
        userId,
        role: "host",
        generation,
        status: "connecting",
        createdAt:
          pendingHost.connectedAt,
        lastHeartbeatAt:
          pendingHost.lastHeartbeatAt,
      };
    } else if (state.host?.sessionId) {
      /*
       * A completed or stale host session must not be reused.
       */
      await provider
        .closeSession(
          state.host.sessionId,
        )
        .catch(() => {});

      await mediaService
        .removeHostSession(
          roomId,
        )
        .catch(() => {});
    }

    if (!session) {
      const sessionResult =
        await provider.createSession({
          roomId,
          userId,
          role: "host",
          generation,
          offerSdp,
        });

      session =
        sessionResult.session;

      if (
        !sessionResult.sessionDescription ||
        sessionResult.sessionDescription.type !==
          "answer"
      ) {
        await provider
          .closeSession(
            session.sessionId,
          )
          .catch(() => {});

        throw new AppError(
          502,
          "Cloudflare did not return the initial host SDP answer",
          {
            code:
              "MEDIA_INITIAL_SDP_ANSWER_MISSING",
          },
        );
      }

      /*
       * Store the session as connecting, not connected.
       * Viewers are explicitly prevented from subscribing
       * until the host completes the second negotiation.
       */
      await mediaService.saveHostSession(
        session,
        videoTrack.trackName,
        audioTrack.trackName,
      );

      return {
        session,
        answerSdp:
          sessionResult.sessionDescription.sdp,
        offerSdp:
          undefined,
        tracks: [],
        requiresRenegotiation:
          false,
      };
    }

    try {
      const negotiation =
        await provider.publishTracks({
          sessionId:
            session.sessionId,
          offerSdp,
          tracks: [
            audioTrack,
            videoTrack,
          ],
        });

      if (!negotiation.answerSdp) {
        throw new AppError(
          502,
          "Cloudflare did not return the host track negotiation answer",
          {
            code:
              "MEDIA_TRACK_SDP_ANSWER_MISSING",
          },
        );
      }

      const connectedSession: MediaSession = {
        ...session,
        status: "connected",
        lastHeartbeatAt:
          Date.now(),
      };

      await mediaService.saveHostSession(
        connectedSession,
        videoTrack.trackName,
        audioTrack.trackName,
      );

      await mediaService.setRoomStatus(
        roomId,
        "live",
      );

      return {
        session:
          connectedSession,
        answerSdp:
          negotiation.answerSdp,
        offerSdp:
          negotiation.offerSdp,
        tracks:
          negotiation.tracks,
        requiresRenegotiation:
          negotiation.requiresRenegotiation,
      };
    } catch (error) {
      await provider
        .closeSession(
          session.sessionId,
        )
        .catch(() => {});

      await mediaService
        .removeHostSession(
          roomId,
        )
        .catch(() => {});

      throw error;
    }
  },

  async publishGuest(
    roomId: string,
    userId: string,
    offerSdp: string,
    tracks: MediaTrack[],
  ) {
    const room =
      await getRoom(roomId);

    if (
      room.host_id === userId
    ) {
      throw new AppError(
        409,
        "Host cannot join as a guest",
        {
          code:
            "HOST_CANNOT_BE_GUEST",
        },
      );
    }

    if (
      !stringValue(offerSdp)
    ) {
      throw new AppError(
        400,
        "offerSdp is required",
        {
          code:
            "MEDIA_SDP_OFFER_REQUIRED",
        },
      );
    }

    const audioTrack =
      requireTrack(
        tracks,
        "audio",
      );

    /*
     * Guest video is optional.
     *
     * This is what allows the single guest video
     * slot to coexist with the three audio slots.
     */
    const videoTrack =
      tracks.find(
        (track) =>
          track.kind ===
          "video",
      );

    const state =
      await mediaService.getRoomState(
        roomId,
      );

    const currentGuestCount =
      Object.keys(
        state.speakers,
      ).length;

    if (
      currentGuestCount >=
      room.max_guest_slots
    ) {
      throw new AppError(
        409,
        "All guest slots are full",
        {
          code:
            "MEDIA_GUEST_SLOTS_FULL",
        },
      );
    }

    const generation =
      state.generation;

    const provider =
      await mediaService.getProvider();

    const sessionResult =
      await provider.createSession({
        roomId,
        userId,
        role: "speaker",
        generation,
        offerSdp,
      });

    try {
      const publishTracks =
        videoTrack
          ? [
              audioTrack,
              videoTrack,
            ]
          : [audioTrack];

      const negotiation =
        await provider.publishTracks({
          sessionId:
            sessionResult.session
              .sessionId,
          offerSdp,
          tracks:
            publishTracks,
        });

      /*
       * Speaker always has audio.
       *
       * Video is optional. An empty videoTrackName
       * means this speaker occupies an audio slot only.
       */
      await mediaService.saveSpeakerSession(
        sessionResult.session,
        audioTrack.trackName,
        videoTrack?.trackName ?? "",
      );

      return {
        session:
          sessionResult.session,
        answerSdp:
          negotiation.answerSdp,
        offerSdp:
          negotiation.offerSdp,
        tracks:
          negotiation.tracks,
        requiresRenegotiation:
          negotiation.requiresRenegotiation,
      };
    } catch (error) {
      await provider
        .closeSession(
          sessionResult.session
            .sessionId,
        )
        .catch(() => {});

      throw error;
    }
  },

  async unpublishGuest(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const state =
      await mediaService.getRoomState(
        roomId,
      );

    const speaker =
      state.speakers[userId];

    if (
      speaker?.sessionId
    ) {
      const provider =
        await mediaService.getProvider();

      await provider
        .closeSession(
          speaker.sessionId,
        )
        .catch(() => {});
    }

    await mediaService
      .removeSpeakerSession(
        roomId,
        userId,
      );

    await roomState
      .removeVideoSpeaker(
        roomId,
        userId,
      );

    await roomState.removeSpeaker(
      roomId,
      userId,
    );
  },

  async createViewerSession(
    roomId: string,
    userId: string,
    offerSdp: string,
  ) {
    /*
     * IMPORTANT:
     *
     * Fetch the room status immediately before
     * creating the Cloudflare viewer session.
     *
     * If the host ended the room while this viewer
     * was loading, this prevents a new viewer session
     * from being created after the live is already over.
     */
    const room =
      await getRoom(roomId);

    if (
      room.host_id === userId
    ) {
      throw new AppError(
        409,
        "Host cannot join as a viewer",
        {
          code:
            "HOST_CANNOT_BE_VIEWER",
        },
      );
    }

    if (
      !stringValue(offerSdp)
    ) {
      throw new AppError(
        400,
        "offerSdp is required",
        {
          code:
            "MEDIA_SDP_OFFER_REQUIRED",
        },
      );
    }

    const state =
      await mediaService.getRoomState(
        roomId,
      );

    /*
     * The room can theoretically end between
     * getRoom() above and this state read.
     *
     * Re-check the durable room status so we never
     * create a viewer session for an ended room.
     */
    const {
      data: latestRoom,
      error: latestRoomError,
    } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .maybeSingle();

    if (
      latestRoomError
    ) {
      throw new AppError(
        500,
        "Failed to verify room status",
        {
          code:
            "ROOM_STATUS_CHECK_FAILED",
          details:
            latestRoomError.message,
        },
      );
    }

    if (
      !latestRoom ||
      latestRoom.status !== "live"
    ) {
      throw new AppError(
        409,
        "Room is not live",
        {
          code:
            "ROOM_NOT_LIVE",
        },
      );
    }

    if (
      !state.host ||
      state.host.status !== "connected"
    ) {
      throw new AppError(
        409,
        "Host media is not available yet",
        {
          code:
            "MEDIA_HOST_NOT_PUBLISHED",
        },
      );
    }

    /*
     * Subscribe to the host's video and audio.
     */
    const tracks: RemoteMediaTrack[] =
      [
        {
          sessionId:
            state.host
              .sessionId,
          trackName:
            state.host
              .videoTrackName,
        },
        {
          sessionId:
            state.host
              .sessionId,
          trackName:
            state.host
              .audioTrackName,
        },
      ];

    /*
     * Add every active speaker's audio.
     *
     * If a speaker has video enabled, also subscribe
     * to that speaker's video.
     */
    for (
      const speaker of Object.values(
        state.speakers,
      )
    ) {
      tracks.push({
        sessionId:
          speaker.sessionId,
        trackName:
          speaker.audioTrackName,
      });

      if (
        speaker.videoTrackName
      ) {
        tracks.push({
          sessionId:
            speaker.sessionId,
          trackName:
            speaker.videoTrackName,
        });
      }
    }

    const generation =
      state.generation;

    const provider =
      await mediaService.getProvider();

    const pendingViewer =
      state.viewers?.[userId];

    let session: MediaSession | null =
      pendingViewer &&
      pendingViewer.generation === generation &&
      pendingViewer.status === "connecting"
        ? {
            sessionId:
              pendingViewer.sessionId,
            roomId,
            userId,
            role: "viewer",
            generation,
            status: "connecting",
            createdAt:
              pendingViewer.joinedAt,
            lastHeartbeatAt:
              pendingViewer.lastHeartbeatAt,
          }
        : null;

    if (
      !session &&
      pendingViewer?.sessionId
    ) {
      await provider
        .closeSession(
          pendingViewer.sessionId,
        )
        .catch(() => {});

      await mediaService
        .removeViewerSession(
          roomId,
          userId,
        )
        .catch(() => {});
    }

    if (!session) {
      const sessionResult =
        await provider.createSession({
          roomId,
          userId,
          role: "viewer",
          generation,
          offerSdp,
        });

      session =
        sessionResult.session;

      if (
        !sessionResult.sessionDescription ||
        sessionResult.sessionDescription.type !==
          "answer"
      ) {
        await provider
          .closeSession(
            session.sessionId,
          )
          .catch(() => {});

        throw new AppError(
          502,
          "Cloudflare did not return the initial viewer SDP answer",
          {
            code:
              "MEDIA_INITIAL_SDP_ANSWER_MISSING",
          },
        );
      }

      await mediaService.saveViewerSession(
        session,
      );

      return {
        session,
        answerSdp:
          sessionResult.sessionDescription.sdp,
        offerSdp:
          undefined,
        tracks: [],
        requiresRenegotiation:
          false,
      };
    }

    try {
      const negotiation =
        await provider.subscribeTracks({
          sessionId:
            session.sessionId,
          offerSdp,
          tracks,
        });

      /*
       * Pulling remote tracks can return either:
       *
       *   1. an SDP answer, which completes the negotiation, or
       *   2. an SDP offer requiring the browser to create an
       *      answer and call /renegotiate.
       *
       * Cloudflare commonly returns the second form when remote
       * tracks are added to an already-connected session.
       */
      if (
        !negotiation.answerSdp &&
        !negotiation.offerSdp
      ) {
        throw new AppError(
          502,
          "Cloudflare did not return a viewer track negotiation SDP",
          {
            code:
              "MEDIA_TRACK_SDP_MISSING",
          },
        );
      }

      /*
       * Do one final durable status check before keeping the
       * viewer session alive. The viewer may still be in the
       * connecting state when Cloudflare returned an offer.
       */
      const {
        data: finalRoom,
        error: finalRoomError,
      } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", roomId)
        .maybeSingle();

      if (
        finalRoomError
      ) {
        throw new AppError(
          500,
          "Failed to verify final room status",
          {
            code:
              "ROOM_STATUS_CHECK_FAILED",
            details:
              finalRoomError.message,
          },
        );
      }

      if (
        !finalRoom ||
        finalRoom.status !== "live"
      ) {
        throw new AppError(
          409,
          "Room has ended",
          {
            code:
              "ROOM_NOT_LIVE",
          },
        );
      }

      if (negotiation.answerSdp) {
        const connectedSession: MediaSession = {
          ...session,
          status: "connected",
          lastHeartbeatAt:
            Date.now(),
        };

        await mediaService.saveViewerSession(
          connectedSession,
        );

        return {
          session:
            connectedSession,
          answerSdp:
            negotiation.answerSdp,
          offerSdp:
            negotiation.offerSdp,
          tracks:
            negotiation.tracks,
          requiresRenegotiation:
            negotiation.requiresRenegotiation,
        };
      }

      return {
        session,
        answerSdp:
          undefined,
        offerSdp:
          negotiation.offerSdp,
        tracks:
          negotiation.tracks,
        requiresRenegotiation:
          true,
      };
    } catch (error) {
      await provider
        .closeSession(
          session.sessionId,
        )
        .catch(() => {});

      await mediaService
        .removeViewerSession(
          roomId,
          userId,
        )
        .catch(() => {});

      throw error;
    }
  },

  async completeRenegotiation(
    roomId: string,
    userId: string,
    answerSdp: string,
  ) {
    const state =
      await mediaService.getRoomState(
        roomId,
      );

    const viewer =
      state.viewers?.[userId];

    const speaker =
      state.speakers[userId];

    const sessionId =
      viewer?.sessionId ??
      speaker?.sessionId;

    if (!sessionId) {
      throw new AppError(
        404,
        "Media session not found",
        {
          code:
            "MEDIA_SESSION_NOT_FOUND",
        },
      );
    }

    const provider =
      await mediaService.getProvider();

    await provider.renegotiate({
      sessionId,
      answerSdp,
    });

    /*
     * The viewer is only fully connected after Cloudflare has
     * accepted the answer to its remote-track offer. Persist the
     * connected state here so other viewers do not attempt to
     * use a half-negotiated session.
     */
    if (viewer) {
      await mediaService.saveViewerSession({
        sessionId,
        roomId,
        userId,
        role: "viewer",
        generation:
          viewer.generation,
        status: "connected",
        createdAt:
          viewer.joinedAt,
        lastHeartbeatAt:
          Date.now(),
      });
    }
  },

  async leaveViewer(
    roomId: string,
    userId: string,
  ) {
    const state =
      await mediaService.getRoomState(
        roomId,
      );

    const viewer =
      state.viewers?.[userId];

    if (
      viewer?.sessionId
    ) {
      const provider =
        await mediaService.getProvider();

      await provider
        .closeSession(
          viewer.sessionId,
        )
        .catch(() => {});
    }

    await mediaService
      .removeViewerSession(
        roomId,
        userId,
      );
  },

  async heartbeat(
    roomId: string,
    userId: string,
    role:
      | "host"
      | "speaker"
      | "viewer",
    sessionId: string,
    generation: number,
  ) {
    const room =
      await getRoom(roomId);

    const state =
      await mediaService.getRoomState(
        roomId,
      );

    if (
      generation !==
      state.generation
    ) {
      throw new AppError(
        409,
        "Media generation is stale",
        {
          code:
            "MEDIA_GENERATION_STALE",
        },
      );
    }

    if (role === "host") {
      if (
        room.host_id !==
          userId ||
        state.host?.sessionId !==
          sessionId
      ) {
        throw new AppError(
          403,
          "Invalid host media session",
          {
            code:
              "MEDIA_HOST_SESSION_INVALID",
          },
        );
      }

      await mediaService.touchHostSession(
        roomId,
        sessionId,
      );

      return;
    }

    if (
      role === "speaker"
    ) {
      const speaker =
        state.speakers[
          userId
        ];

      if (
        !speaker ||
        speaker.sessionId !==
          sessionId
      ) {
        throw new AppError(
          403,
          "Invalid speaker media session",
          {
            code:
              "MEDIA_SPEAKER_SESSION_INVALID",
          },
        );
      }

      await mediaService.touchSpeakerSession(
        roomId,
        userId,
        sessionId,
      );

      return;
    }

    const viewer =
      state.viewers?.[userId];

    if (
      !viewer ||
      viewer.sessionId !==
        sessionId
    ) {
      throw new AppError(
        403,
        "Invalid viewer media session",
        {
          code:
            "MEDIA_VIEWER_SESSION_INVALID",
        },
      );
    }

    await mediaService.touchViewerSession(
      roomId,
      userId,
      sessionId,
    );
  },

  async shutdownRoom(
    roomId: string,
  ): Promise<void> {
    const state =
      await mediaService.getRoomState(
        roomId,
      );

    await mediaService.setRoomStatus(
      roomId,
      "ending",
    );

    const provider =
      await mediaService.getProvider();

    const sessionIds =
      new Set<string>();

    if (
      state.host?.sessionId
    ) {
      sessionIds.add(
        state.host.sessionId,
      );
    }

    for (
      const speaker of Object.values(
        state.speakers,
      )
    ) {
      if (
        speaker.sessionId
      ) {
        sessionIds.add(
          speaker.sessionId,
        );
      }
    }

    for (
      const viewer of Object.values(
        state.viewers,
      )
    ) {
      if (
        viewer.sessionId
      ) {
        sessionIds.add(
          viewer.sessionId,
        );
      }
    }

    await Promise.all(
      [
        ...sessionIds,
      ].map(
        (sessionId) =>
          provider
            .closeSession(
              sessionId,
            )
            .catch(() => {}),
      ),
    );

    /*
     * Increment generation before clearing the
     * participants. This invalidates all old
     * heartbeats and prevents stale sessions from
     * becoming active again.
     */
    await mediaService.incrementGeneration(
      roomId,
    );

    await mediaService.setRoomStatus(
      roomId,
      "ended",
    );

    await mediaService.clearParticipants(
      roomId,
    );

    await roomState.clear(
      roomId,
    );
  },
};