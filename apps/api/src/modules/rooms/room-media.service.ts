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
     * SINGLE-PHASE PUBLISH — matches the browser exactly.
     *
     * publishHostMedia() on the client builds ONE RTCPeerConnection,
     * creates exactly ONE SDP offer (with mids already assigned via
     * addTransceiver + setLocalDescription), and makes exactly ONE call
     * to this endpoint. It never performs a second negotiation round
     * against the same PeerConnection.
     *
     * This used to be split into two separate phases that each required
     * their own client round trip (create the Cloudflare session with
     * /sessions/new, wait for the client to reconnect and call again,
     * THEN publish tracks via /tracks/new). Because the client only ever
     * calls this endpoint once, that second phase never ran: the host's
     * session stayed stuck in "connecting" forever, tracks were never
     * registered with Cloudflare, and every viewer's
     * waitForHostMediaState() poll timed out with
     * "Host is still connecting. Try again."
     *
     * The fix is to do both Cloudflare calls (create session, then
     * publish tracks against that session) inside this ONE request,
     * exactly like publishGuest() already does for speakers below.
     */
    let session: MediaSession | null = null;
    let createdNewSession = false;

    try {
      const existingHost = state.host;

      const hasReusableSession =
        existingHost &&
        existingHost.userId === userId &&
        (existingHost.status === "connecting" ||
          existingHost.status === "connected" ||
          existingHost.status === "reconnecting");

      if (!hasReusableSession) {
        const sessionResult = await provider.createSessionOnly({
          roomId,
          userId,
          role: "host",
          generation,
        });

        session = sessionResult.session;
        createdNewSession = true;

        await mediaService.saveHostSession(
          session,
          videoTrack.trackName,
          audioTrack.trackName,
        );
      } else {
        session = {
          sessionId: existingHost.sessionId,
          roomId,
          userId: existingHost.userId,
          role: "host",
          generation: existingHost.generation,
          status: existingHost.status,
          createdAt: existingHost.connectedAt,
          lastHeartbeatAt: existingHost.lastHeartbeatAt,
        };
      }

      const negotiation = await provider.publishTracks({
        sessionId: session.sessionId,
        offerSdp,
        tracks: [audioTrack, videoTrack],
      });

      if (!negotiation.answerSdp) {
        throw new AppError(
          502,
          "Cloudflare did not return the host track negotiation answer",
          { code: "MEDIA_TRACK_SDP_ANSWER_MISSING" },
        );
      }

      const connectedSession: MediaSession = {
        ...session,
        status: "connected",
        lastHeartbeatAt: Date.now(),
      };

      await mediaService.saveHostSession(
        connectedSession,
        videoTrack.trackName,
        audioTrack.trackName,
      );

      await mediaService.setRoomStatus(roomId, "live");

      return {
        session: connectedSession,
        answerSdp: negotiation.answerSdp,
        offerSdp: negotiation.offerSdp,
        tracks: negotiation.tracks,
        requiresRenegotiation: negotiation.requiresRenegotiation,
      };
    } catch (error) {
      if (session && createdNewSession) {
        await provider.closeSession(session.sessionId).catch(() => {});
        await mediaService.removeHostSession(roomId).catch(() => {});
      }

      throw error;
    }
  },


  async subscribeViewerToSpeakers(
  roomId: string,
  userId: string,
  offerSdp: string,
  answerSdp?: string,
  speakerIds?: string[],
) {
  const room = await getRoom(roomId);

  if (room.host_id === userId) {
    throw new AppError(409, "Host cannot join as a viewer", {
      code: "HOST_CANNOT_BE_VIEWER",
    });
  }

  if (!answerSdp && !stringValue(offerSdp)) {
    throw new AppError(400, "offerSdp or answerSdp is required", {
      code: "MEDIA_SDP_REQUIRED",
    });
  }

  const state = await mediaService.getRoomState(roomId);
  const viewer = state.viewers?.[userId];

  // This is the whole point of this endpoint: reuse the viewer's EXISTING
  // Cloudflare session instead of spinning up a new, disconnected one.
  // createViewerSession() only knows how to create-or-resume a "connecting"
  // session; once a viewer is fully "connected" there was previously no
  // way to add a newly-joined speaker's track without silently creating
  // a second, unrelated session that the browser's RTCPeerConnection
  // was never bound to.
  if (!viewer || viewer.status !== "connected") {
    throw new AppError(409, "Viewer media is not connected", {
      code: "MEDIA_VIEWER_NOT_CONNECTED",
    });
  }

  /*
   * A speaker entry appears in Redis as soon as publishGuest's FIRST
   * negotiation phase completes (session created, status "connecting").
   * The guest's actual audio track is only registered with Cloudflare
   * during the SECOND phase (publishTracks), which flips status to
   * "connected". Subscribing before that leaves this viewer's peer
   * connection referencing a track Cloudflare hasn't registered yet,
   * and it never gets retried once marked "already subscribed" on the
   * client. Only subscribe to speakers whose track publish has
   * actually completed.
   */
  const speakerEntries = (
    speakerIds && speakerIds.length > 0
      ? speakerIds
          .filter((id) => state.speakers[id])
          .map((id) => [id, state.speakers[id]] as const)
      : Object.entries(state.speakers)
  ).filter(([, speaker]) => speaker.status === "connected");

  const tracks: RemoteMediaTrack[] = speakerEntries.map(([, speaker]) => ({
    sessionId: speaker.sessionId,
    trackName: speaker.audioTrackName,
  }));

  if (tracks.length === 0) {
    console.warn("[GUEST-DEBUG][BE] subscribeViewerToSpeakers NO_GUEST_AUDIO", {
      roomId, viewerUserId: userId, requestedSpeakerIds: speakerIds,
      allSpeakerStatuses: Object.fromEntries(
        Object.entries(state.speakers).map(([id, s]) => [id, s.status]),
      ),
    });
    throw new AppError(409, "No guest audio is active", {
      code: "NO_GUEST_AUDIO",
    });
  }

  const provider = await mediaService.getProvider();

  if (answerSdp) {
    await provider.renegotiate({
      sessionId: viewer.sessionId,
      answerSdp,
    });

    return {
      session: { sessionId: viewer.sessionId, generation: viewer.generation, status: viewer.status },
      answerSdp: undefined,
      offerSdp: undefined,
      tracks: [],
      requiresRenegotiation: false,
      alreadySubscribed: false,
    };
  }

  const negotiation = await provider.subscribeTracks({
    sessionId: viewer.sessionId,
    offerSdp,
    tracks,
  });

  if (!negotiation.answerSdp && !negotiation.offerSdp) {
    return {
      session: { sessionId: viewer.sessionId, generation: viewer.generation, status: viewer.status },
      answerSdp: undefined,
      offerSdp: undefined,
      tracks: [],
      requiresRenegotiation: false,
      alreadySubscribed: true,
    };
  }

  return {
    session: { sessionId: viewer.sessionId, generation: viewer.generation, status: viewer.status },
    answerSdp: negotiation.answerSdp,
    offerSdp: negotiation.offerSdp,
    tracks: negotiation.tracks,
    requiresRenegotiation: negotiation.requiresRenegotiation,
    alreadySubscribed: false,
  };
},



async subscribeHostToGuests(
  roomId: string,
  userId: string,
  offerSdp: string,
  answerSdp?: string,
  speakerIds?: string[],
) {
  const room = await getRoom(roomId);

  if (room.host_id !== userId) {
    throw new AppError(403, "Only the room host can subscribe to guests", {
      code: "ROOM_HOST_REQUIRED",
    });
  }

  if (!answerSdp && !stringValue(offerSdp)) {
    throw new AppError(400, "offerSdp or answerSdp is required", {
      code: "MEDIA_SDP_REQUIRED",
    });
  }

  const state = await mediaService.getRoomState(roomId);
  if (!state.host || state.host.userId !== userId || state.host.status !== "connected") {
    throw new AppError(409, "Host media is not connected", {
      code: "MEDIA_HOST_NOT_CONNECTED",
    });
  }

  /*
   * A speaker entry appears in Redis as soon as publishGuest's FIRST
   * negotiation phase completes (session created, status "connecting").
   * The guest's actual audio track is only registered with Cloudflare
   * during the SECOND phase (publishTracks), which flips status to
   * "connected". The host polls every ~1.8s, so it can easily land in
   * the gap between those two phases (the guest also has to wait for
   * its PeerConnection to reach "connected" before phase two even
   * fires). If the host subscribes during that gap, Cloudflare accepts
   * the request against a track that doesn't exist yet, the peer
   * connection reports success, and the client marks that speakerId as
   * "already handled" — so the host never re-subscribes even after the
   * guest finishes publishing, and that viewer's mic never comes
   * through. Only subscribe to speakers whose track publish has
   * actually completed; unready speakers are simply skipped and picked
   * up on the next poll once they flip to "connected".
   */
  const speakerEntries = (
    speakerIds && speakerIds.length > 0
      ? speakerIds
          .filter((id) => state.speakers[id])
          .map((id) => [id, state.speakers[id]] as const)
      : Object.entries(state.speakers)
  ).filter(([, speaker]) => speaker.status === "connected");

  const tracks: RemoteMediaTrack[] = speakerEntries.map(([, speaker]) => ({
    sessionId: speaker.sessionId,
    trackName: speaker.audioTrackName,
  }));

  if (tracks.length === 0) {
    console.warn("[GUEST-DEBUG][BE] subscribeHostToGuests NO_GUEST_AUDIO", {
      roomId, hostUserId: userId, requestedSpeakerIds: speakerIds,
      allSpeakerStatuses: Object.fromEntries(
        Object.entries(state.speakers).map(([id, s]) => [id, s.status]),
      ),
    });
    throw new AppError(409, "No guest audio is active", {
      code: "NO_GUEST_AUDIO",
    });
  }

  const provider = await mediaService.getProvider();

  if (answerSdp) {
    await provider.renegotiate({
      sessionId: state.host.sessionId,
      answerSdp,
    });

    return {
      session: {
        sessionId: state.host.sessionId,
        generation: state.host.generation,
        status: state.host.status,
      },
      answerSdp: undefined,
      offerSdp: undefined,
      tracks: [],
      requiresRenegotiation: false,
      alreadySubscribed: false, // not needed here
    };
  }

  const negotiation = await provider.subscribeTracks({
    sessionId: state.host.sessionId,
    offerSdp,
    tracks,
  });

  // --- NEW: Detect empty SDP and return a flag ---
  if (!negotiation.answerSdp && !negotiation.offerSdp) {
    // All requested tracks are already subscribed.
    return {
      session: {
        sessionId: state.host.sessionId,
        generation: state.host.generation,
        status: state.host.status,
      },
      answerSdp: undefined,
      offerSdp: undefined,
      tracks: [],
      requiresRenegotiation: false,
      alreadySubscribed: true, // ✅ New flag
    };
  }

  return {
    session: {
      sessionId: state.host.sessionId,
      generation: state.host.generation,
      status: state.host.status,
    },
    answerSdp: negotiation.answerSdp,
    offerSdp: negotiation.offerSdp,
    tracks: negotiation.tracks,
    requiresRenegotiation: negotiation.requiresRenegotiation,
    alreadySubscribed: false,
  };
},

  async publishGuest(
    roomId: string,
    userId: string,
    offerSdp: string,
    tracks: MediaTrack[],
  ) {
    console.log("[GUEST-DEBUG][BE] publishGuest called", {
      roomId,
      userId,
      trackKinds: tracks.map((t) => t.kind),
    });

    const room = await getRoom(roomId);

    if (room.host_id === userId) {
      throw new AppError(409, "Host cannot join as a guest", {
        code: "HOST_CANNOT_BE_GUEST",
      });
    }

    if (!stringValue(offerSdp)) {
      throw new AppError(400, "offerSdp is required", {
        code: "MEDIA_SDP_OFFER_REQUIRED",
      });
    }

    const audioTrack = requireTrack(tracks, "audio");
    const videoTrack = tracks.find((track) => track.kind === "video");

    const state = await mediaService.getRoomState(roomId);
    const existingSpeaker = state.speakers[userId];

    if (!existingSpeaker) {
      const isApprovedSpeaker = await roomState.isSpeaker(roomId, userId);

      if (!isApprovedSpeaker) {
        throw new AppError(403, "You have not been approved to speak", {
          code: "ROOM_SPEAKER_NOT_APPROVED",
        });
      }

      const currentGuestCount = Object.keys(state.speakers).length;
      if (currentGuestCount >= Math.min(room.max_guest_slots ?? 3, 3)) {
        throw new AppError(409, "All guest slots are full", {
          code: "MEDIA_GUEST_SLOTS_FULL",
        });
      }
    }

    const generation = state.generation;
    const provider = await mediaService.getProvider();
    let session: MediaSession | null = null;
    let createdNewSession = false;

    try {
      /*
       * Cloudflare's documented publisher lifecycle is:
       *
       *   POST /sessions/new                 -> sessionId only
       *   POST /sessions/{id}/tracks/new     -> SDP offer + local tracks
       *                                           -> SDP answer
       *
       * The browser must receive that single SDP answer and apply it to
       * the SAME RTCPeerConnection that generated `offerSdp`.
       *
       * Do not perform a first browser negotiation against /sessions/new
       * and then create a second offer. That creates an unnecessary SDP
       * phase and, in this room flow, was leaving the guest's media track
       * unregistered / with zero outbound RTP.
       */
      if (!existingSpeaker) {
        const sessionResult = await provider.createSessionOnly({
          roomId,
          userId,
          role: "speaker",
          generation,
        });

        session = sessionResult.session;
        createdNewSession = true;

        await mediaService.saveSpeakerSession(
          session,
          audioTrack.trackName,
          videoTrack?.trackName ?? "",
        );
      } else {
        if (
          existingSpeaker.status !== "connecting" &&
          existingSpeaker.status !== "connected" &&
          existingSpeaker.status !== "reconnecting"
        ) {
          throw new AppError(409, "Speaker media session is not available", {
            code: "MEDIA_SPEAKER_SESSION_UNAVAILABLE",
          });
        }

        session = {
          sessionId: existingSpeaker.sessionId,
          roomId,
          userId: existingSpeaker.userId,
          role: "speaker",
          generation: existingSpeaker.generation,
          status: existingSpeaker.status,
          createdAt: existingSpeaker.joinedAt,
          lastHeartbeatAt: existingSpeaker.lastHeartbeatAt,
        };
      }

      const publishTracks = videoTrack
        ? [audioTrack, videoTrack]
        : [audioTrack];

      console.log("[GUEST-DEBUG][BE] publishing local tracks", {
        roomId,
        userId,
        sessionId: session.sessionId,
        trackCount: publishTracks.length,
        tracks: publishTracks.map((track) => ({
          kind: track.kind,
          trackName: track.trackName,
          mid: track.mid,
        })),
      });

      const negotiation = await provider.publishTracks({
        sessionId: session.sessionId,
        offerSdp,
        tracks: publishTracks,
      });

      if (!negotiation.answerSdp) {
        throw new AppError(
          502,
          "Cloudflare did not return the SDP answer for guest track publication",
          { code: "MEDIA_TRACK_SDP_ANSWER_MISSING" },
        );
      }

      const connectedSession: MediaSession = {
        ...session,
        status: "connected",
        lastHeartbeatAt: Date.now(),
      };

      await mediaService.saveSpeakerSession(
        connectedSession,
        audioTrack.trackName,
        videoTrack?.trackName ?? existingSpeaker?.videoTrackName ?? "",
      );

      console.log("[GUEST-DEBUG][BE] guest publish CONNECTED", {
        roomId,
        userId,
        sessionId: connectedSession.sessionId,
      });

      return {
        session: connectedSession,
        answerSdp: negotiation.answerSdp,
        offerSdp: negotiation.offerSdp,
        tracks: negotiation.tracks,
        requiresRenegotiation: negotiation.requiresRenegotiation,
      };
    } catch (error) {
      console.error("[GUEST-DEBUG][BE] publishGuest FAILED", {
        roomId,
        userId,
        sessionId: session?.sessionId,
        createdNewSession,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });

      if (session && createdNewSession) {
        await provider.closeSession(session.sessionId).catch(() => {});
        await mediaService.removeSpeakerSession(roomId, userId).catch(() => {});
      }

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
     * Fetch the room status immediately before creating the
     * Cloudflare viewer session.
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
     * Re-check the durable room status so we never create
     * a viewer session for an ended room.
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
    const tracks: RemoteMediaTrack[] = [
      {
        sessionId:
          state.host.sessionId,
        trackName:
          state.host.videoTrackName,
      },
      {
        sessionId:
          state.host.sessionId,
        trackName:
          state.host.audioTrackName,
      },
    ];

    /*
     * Add every active speaker's audio and optional video.
     *
     * Only speakers whose publish has actually completed
     * (status "connected") have a real track registered with
     * Cloudflare. A speaker entry appears here as soon as
     * publishGuest's FIRST negotiation phase finishes (status
     * "connecting"), before their mic track exists. A newly
     * joining/reloading viewer must skip those for now — the
     * client seeds its "already subscribed" set from this same
     * list, so including an unready speaker here would silently
     * and permanently mute them for this viewer instead of
     * picking them up on the next poll once they're ready.
     */
    for (
      const speaker of Object.values(
        state.speakers,
      )
    ) {
      if (speaker.status !== "connected") continue;

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

    /*
     * Cloudflare's current Connection API uses:
     *
     *   POST /sessions/new
     *       -> create the session only
     *
     *   POST /sessions/:sessionId/tracks/new
     *       -> send the browser SDP offer and the remote tracks
     *
     * For a viewer, tracks/new may return either:
     *
     *   - an SDP answer, completing negotiation immediately, or
     *   - an SDP offer, which must be answered through
     *     PUT /sessions/:sessionId/renegotiate.
     */
    let session: MediaSession | null = null;

    try {
      const existingViewer =
        state.viewers?.[userId];

      const hasConnectingSession =
        existingViewer &&
        existingViewer.status === "connecting" &&
        existingViewer.sessionId;

      if (!hasConnectingSession) {
        /*
         * FIRST call: create the Cloudflare session only,
         * exactly like the host flow. Do NOT subscribe to
         * remote tracks yet — the browser must apply this
         * answer and reach PeerConnection "connected" before
         * Cloudflare will accept /tracks/new for this session.
         */
        const sessionResult =
          await provider.createSession({
            roomId,
            userId,
            role: "viewer",
            generation,
            offerSdp,
          });

        session = sessionResult.session;

        await mediaService.saveViewerSession(
          session,
        );

        return {
          session,
          answerSdp:
            sessionResult.sessionDescription?.sdp,
          offerSdp: undefined,
          tracks: [],
          requiresRenegotiation: false,
        };
      }

      /*
       * SECOND call: the PeerConnection is already connected.
       * Reuse the existing Cloudflare session instead of
       * creating a brand new one — the browser's
       * RTCPeerConnection is already bound to the first
       * session's ICE/DTLS state, so issuing a second
       * /sessions/new here would negotiate against a session
       * the browser never applied.
       */
      session = {
        sessionId: existingViewer.sessionId,
        roomId,
        userId: existingViewer.userId,
        role: "viewer",
        generation: existingViewer.generation,
        status: existingViewer.status,
        createdAt: existingViewer.joinedAt,
        lastHeartbeatAt: existingViewer.lastHeartbeatAt,
      };

      const negotiation =
        await provider.subscribeTracks({
          sessionId:
            existingViewer.sessionId,
          offerSdp,
          tracks,
        });

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
       * Verify the room is still live after the Cloudflare
       * negotiation. If the room ended during negotiation,
       * don't leave the viewer session behind.
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

      if (
        negotiation.answerSdp
      ) {
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

      /*
       * Cloudflare returned an offer. The browser must apply it,
       * create an answer, and send that answer to the existing
       * session's /renegotiate endpoint.
       */
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
      if (session) {
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
      }

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