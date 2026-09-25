import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { mediaService } from "../media";
import { roomState } from "./room-state.service";
import { roomService } from "./room.service";
import { mediaConfig } from "../../config/media.config";
import { CloudflareRealtimeError } from "../../lib/media/cloudflare/cloudflare.errors";
import { redis } from "../../lib/redis";
import { mediaKeys } from "../media/media.state";
import { roomStageService } from "./room-state.service";
import type {
  MediaSession,
  MediaTrack,
  RemoteMediaTrack,
  RoomMediaState,
} from "../media/media.types";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Cloudflare returns 410 Gone when a sessionId we hold (e.g. reused from
 * Redis) no longer exists on its side - the session was already torn down
 * (TTL expiry, disconnect, GC) even though our own state still thinks it's
 * "connecting"/"connected"/"reconnecting". Redis's view of liveness is not
 * authoritative; Cloudflare's is. Treat 410 on a *reused* session as a
 * signal to stop trusting the cached sessionId, not as a terminal failure.
 */
function isStaleSessionError(error: unknown): boolean {
  return (
    error instanceof CloudflareRealtimeError &&
    error.statusCode === 410
  );
}

/**
 * Server-side ceiling on concurrent guest/speaker seats for a room.
 * `room.max_guest_slots` is set by whoever created the room and is never
 * trusted on its own — this clamps it to the hard per-media-type limit
 * (3 for video, 10 for mic-only audio rooms) so a room can't be created
 * with an inflated seat count and overload the SFU.
 */
export function resolveMaxGuestSlots(
  mediaType: string | null | undefined,
  requestedSlots: number | null | undefined,
): number {
  const cap =
    mediaType === "audio"
      ? mediaConfig.limits.maxGuestSlots.audio
      : mediaConfig.limits.maxGuestSlots.video;

  return Math.min(requestedSlots ?? cap, cap);
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
      "id, host_id, status, max_guest_slots, media_type",
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
    let state = await mediaService.getRoomState(
      roomId,
    );

    state = await reapDeadSpeakers(roomId, state);

    return applyHostReconnectGrace(roomId, state);
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

    const isAudioRoom = room.media_type === "audio";

    /*
     * Video rooms publish camera + mic. Audio (party) rooms never have a
     * camera, so they publish the raw mic (heard by people on stage) and,
     * optionally, the host's pre-mixed audience feed (role "mix", see
     * useAudioRoom) that plain listeners subscribe to instead of one
     * track per speaker.
     */
    const audioTrack = isAudioRoom
      ? (tracks.find(
          (track) => track.kind === "audio" && track.role !== "mix",
        ) ?? requireTrack(tracks, "audio"))
      : requireTrack(tracks, "audio");

    const mixTrack = isAudioRoom
      ? tracks.find((track) => track.kind === "audio" && track.role === "mix")
      : undefined;

    const videoTrack = isAudioRoom
      ? undefined
      : requireTrack(tracks, "video");

    const publishList: MediaTrack[] = isAudioRoom
      ? mixTrack
        ? [audioTrack, mixTrack]
        : [audioTrack]
      : [audioTrack, videoTrack as MediaTrack];

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
          videoTrack?.trackName ?? "",
          audioTrack.trackName,
          mixTrack?.trackName,
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
        tracks: publishList,
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
        videoTrack?.trackName ?? "",
        audioTrack.trackName,
        mixTrack?.trackName,
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

  /*
   * The renegotiate call below (answerSdp branch) operates directly on
   * the viewer's own session with no remote-track reference, so a 410
   * there really does mean the viewer's session is dead. Unlike
   * createViewerSession(), we can't silently swap in a fresh Cloudflare
   * session here - the browser's RTCPeerConnection is already bound to
   * viewer.sessionId, so a session created here would be orphaned from
   * the client's actual peer connection. Surface a distinct, actionable
   * error code so the client knows its whole viewer session is dead and
   * must redo the full connectViewer() handshake (which does create a
   * fresh session) rather than retrying this call against the same
   * stale sessionId forever.
   */
  try {
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
  } catch (error) {
    if (isStaleSessionError(error)) {
      await mediaService.removeViewerSession(roomId, userId).catch(() => {});

      throw new AppError(410, "Viewer session is no longer valid on the media provider", {
        code: "MEDIA_VIEWER_SESSION_STALE",
      });
    }

    throw error;
  }

  let negotiation: Awaited<ReturnType<typeof provider.subscribeTracks>>;

  try {
    negotiation = await provider.subscribeTracks({
      sessionId: viewer.sessionId,
      offerSdp,
      tracks,
    });
  } catch (error) {
    if (!isStaleSessionError(error)) {
      throw error;
    }

    /*
     * This call pulls NEW remote tracks (the just-approved speaker(s))
     * into an already-connected viewer session. Unlike the renegotiate
     * branch above, a 410 here is far more likely to mean one of THOSE
     * speaker sessions is dead on Cloudflare (approved/published, then
     * disconnected, while Redis still says "connected") than that the
     * viewer's own already-working session suddenly died. Blaming the
     * viewer here would force a disruptive full reconnect over what is
     * actually a stale speaker - clean up the implicated speakers
     * instead and let the client simply skip them.
     */
    console.error(
      "[room-media] subscribeViewerToSpeakers hit a stale speaker session on Cloudflare - self-healing room state",
      {
        roomId,
        viewerUserId: userId,
        speakerUserIds: speakerEntries.map(([id]) => id),
      },
    );

    for (const [speakerUserId] of speakerEntries) {
      await mediaService.removeSpeakerSession(roomId, speakerUserId).catch(() => {});
    }

    throw new AppError(503, "One or more speakers disconnected. Please try again.", {
      code: "MEDIA_SPEAKER_SESSION_STALE",
    });
  }

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
      if (currentGuestCount >= resolveMaxGuestSlots(room.media_type, room.max_guest_slots)) {
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
    const roomType = await roomStageService.getMediaType(roomId);

    if (roomType === "audio") {
      // Leaving a seat / a failed publish: same full teardown as a host
      // kick (SFU sessions, seat, approval, participant role).
      await roomStageService.evictSpeaker(roomId, userId);
      return;
    }

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
    preview = false,
    mode: "listener" | "stage" = "listener",
  ) {
    /*
     * Audio party rooms have their own, much lighter join path (no video
     * track, no per-viewer state scan, single mixed track for listeners).
     */
    const cachedRoom = await roomStageService.getRoomLive(roomId);

    if (cachedRoom.media_type === "audio") {
      return createAudioViewerSession(
        cachedRoom,
        userId,
        offerSdp,
        preview,
        mode,
      );
    }

    /*
     * Fetch the room status immediately before creating the
     * Cloudflare viewer session.
     */
    const room =
      await getRoom(
        roomId
      );

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
     * Every speaker userId whose track(s) got added to `tracks` above,
     * so a subscribe failure can be traced back to the Redis entries
     * that need to be invalidated - see subscribeViewerTracksRobustly().
     */
    const speakerUserIdsInTracks: string[] = [];

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
      const [speakerUserId, speaker] of Object.entries(
        state.speakers,
      )
    ) {
      if (speaker.status !== "connected") continue;

      speakerUserIdsInTracks.push(speakerUserId);

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
     * SINGLE-PHASE SUBSCRIBE — matches the browser exactly.
     *
     * connectViewer() on the client builds ONE RTCPeerConnection,
     * reserves all its recvonly transceivers up front, creates exactly
     * ONE SDP offer, and makes exactly ONE call to this endpoint. It
     * never performs a second negotiation round to actually pull tracks.
     *
     * This used to be split into two phases exactly like the host
     * publish bug: the FIRST call created a Cloudflare session via
     * /sessions/new (which, for a viewer, DOES return a usable SDP
     * answer immediately — enough for the browser's PeerConnection to
     * reach "connected"), and a SECOND call was required to actually
     * subscribe to the host/speaker tracks via /tracks/new and flip
     * the stored viewer status to "connected".
     *
     * Because the client only calls this once, that second phase never
     * ran. The result was actively worse than the host bug: the
     * viewer's PeerConnection genuinely reported "connected" (so the
     * client logged "[WebRTC][VIEWER] initial session connected" and
     * believed it was done), while zero real media tracks were ever
     * bound - the viewer heard and saw nothing, and their Redis session
     * stayed at status "connecting" forever, which is exactly what was
     * observed: viewer entries permanently stuck at "connecting" with
     * no way to recover short of a reload creating yet another stuck
     * entry.
     *
     * The fix is the same shape as publishHost(): do both Cloudflare
     * calls (create-or-reuse the session, then subscribe it to the
     * host + speaker tracks) inside this ONE request.
     */
    let session: MediaSession | null = null;
    let createdNewSession = false;

    try {
      const existingViewer =
        state.viewers?.[userId];

      const hasReusableSession =
        existingViewer &&
        existingViewer.userId === userId &&
        (existingViewer.status === "connecting" ||
          existingViewer.status === "connected" ||
          existingViewer.status === "reconnecting");

      if (!hasReusableSession) {
        /*
         * Create the Cloudflare session only - no SDP yet. The actual
         * browser offer (with its already-assigned transceiver mids)
         * is sent below, in the same request, via subscribeTracks().
         */
        const sessionResult = await provider.createSessionOnly({
          roomId,
          userId,
          role: "viewer",
          generation,
        });

        session = sessionResult.session;
        session.preview = preview;
        createdNewSession = true;

        await mediaService.saveViewerSession(session);
      } else {
        /*
         * Reuse the existing session instead of creating a new one -
         * e.g. a previous attempt already created a Cloudflare session
         * for this viewer and got interrupted before it could
         * subscribe tracks. Issuing a second /sessions/new here would
         * negotiate against a session the browser never applied.
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
          // Trust the caller's *current* intent over whatever the stale
          // entry says — e.g. someone previewed this room while
          // scrolling, then actually opened it: that resumed session
          // should now count as a real viewer.
          preview,
        };
      }

      let negotiation: Awaited<
        ReturnType<typeof provider.subscribeTracks>
      >;

      /*
       * Clears out whichever host/speaker Redis entries are lying about
       * being "connected" so the NEXT attempt (manual retry or
       * automatic poll) sees the corrected state instead of failing on
       * the exact same dead remote session forever. Cleanup only - the
       * caller is responsible for throwing.
       */
      async function cleanupStaleRemoteSessions(): Promise<void> {
        console.error(
          "[room-media] viewer subscribe hit a stale remote (host/speaker) session on Cloudflare - self-healing room state",
          {
            roomId,
            userId,
            hostSessionId: state.host?.sessionId,
            speakerUserIds: speakerUserIdsInTracks,
          },
        );

        await mediaService.removeHostSession(roomId).catch(() => {});

        for (const speakerUserId of speakerUserIdsInTracks) {
          await mediaService
            .removeSpeakerSession(roomId, speakerUserId)
            .catch(() => {});
        }
      }

      try {
        negotiation =
          await provider.subscribeTracks({
            sessionId:
              session.sessionId,
            offerSdp,
            tracks,
          });
      } catch (subscribeError) {
        if (!isStaleSessionError(subscribeError)) {
          throw subscribeError;
        }

        if (!createdNewSession) {
          /*
           * The session we reused (hasReusableSession branch) may be
           * stale on Cloudflare's side even though Redis still marked
           * it live. Create a brand-new session and retry once before
           * concluding the problem is actually upstream (host/speaker).
           */
          console.warn(
            "[room-media] stale viewer session on Cloudflare (410) - creating a fresh session",
            { roomId, userId, staleSessionId: session.sessionId },
          );

          const fresh =
            await provider.createSessionOnly({
              roomId,
              userId,
              role: "viewer",
              generation,
            });

          session = fresh.session;
          session.preview = preview;
          createdNewSession = true;

          await mediaService.saveViewerSession(session);

          try {
            negotiation =
              await provider.subscribeTracks({
                sessionId:
                  session.sessionId,
                offerSdp,
                tracks,
              });
          } catch (secondError) {
            if (!isStaleSessionError(secondError)) {
              throw secondError;
            }

            /*
             * A 410 on a session we JUST created cannot mean our own
             * session is stale - it never had a chance to be. It means
             * one of the REMOTE tracks we asked to pull (the host's or
             * a speaker's Cloudflare session) is dead even though Redis
             * still says "connected".
             */
            await cleanupStaleRemoteSessions();

            throw new AppError(
              503,
              "The live stream session is no longer available. Please try again in a moment.",
              { code: "MEDIA_HOST_SESSION_STALE" },
            );
          }
        } else {
          /*
           * Same reasoning as above: this session was created fresh
           * moments ago in this very request, so a 410 here is about a
           * remote track (host/speaker), not about us.
           */
          await cleanupStaleRemoteSessions();

          throw new AppError(
            503,
            "The live stream session is no longer available. Please try again in a moment.",
            { code: "MEDIA_HOST_SESSION_STALE" },
          );
        }
      }

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
      if (session && createdNewSession) {
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

    try {
      await provider.renegotiate({
        sessionId,
        answerSdp,
      });
    } catch (error) {
      if (isStaleSessionError(error)) {
        if (viewer) {
          await mediaService.removeViewerSession(roomId, userId).catch(() => {});
        }

        throw new AppError(410, "Media session is no longer valid on the media provider", {
          code: "MEDIA_VIEWER_SESSION_STALE",
        });
      }

      throw error;
    }

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
        preview:
          viewer.preview,
      });
    }
  },

  async leaveViewer(
    roomId: string,
    userId: string,
  ) {
    const listenerSessionId = await roomStageService.getListenerSession(
      roomId,
      userId,
    );

    if (listenerSessionId) {
      const listenerProvider = await mediaService.getProvider();
      await listenerProvider.closeSession(listenerSessionId).catch(() => {});
      await roomStageService.removeListener(roomId, userId);
      return;
    }

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

    // Listener sessions are deliberately NOT closed one by one (that would
    // be thousands of provider calls at the moment the room ends). Their
    // clients see status "ended" on the next stage poll and close their own
    // peer connection; the SFU also reaps idle sessions on its own.
    await roomStageService.clearRoom(roomId);
  },
};

/**
 * Enforces the host's 60s reconnect grace window on every state read
 * (there's no separate scheduled job — this file's `getState` is already
 * polled continuously by every viewer and the host's own client, so a
 * lazy, read-time check is sufficient and matches how stale
 * speaker/viewer sessions are already reaped elsewhere in this codebase).
 *
 * Note this does NOT open any loophole around who can be host: publishHost
 * above only ever accepts a caller whose userId equals this room's own
 * `rooms.host_id` — that's fixed at room creation and is never touched
 * here. This function only decides how long a *silent* legitimate host
 * gets before the room gives up on them; it can never hand the room to
 * anyone else.
 */
async function applyHostReconnectGrace(
  roomId: string,
  state: RoomMediaState,
): Promise<RoomMediaState> {
  if (!state.host) return state;

  const lastHeartbeatAt = state.host.lastHeartbeatAt || state.host.connectedAt || 0;
  const elapsed = Date.now() - lastHeartbeatAt;

  if (elapsed <= mediaConfig.heartbeat.timeoutMs) {
    // Heartbeating normally within the last beat window — nothing to do.
    return state;
  }

  const deadline = lastHeartbeatAt + mediaConfig.session.hostReconnectGraceMs;

  if (Date.now() >= deadline) {
    // Grace period fully spent with no reconnect — the host is really
    // gone. End the room for real and drop the stale session so it can't
    // sit "live" with nobody ever broadcasting again. Best-effort and
    // idempotent: forceEndRoom's status="live" guard means two concurrent
    // reads racing here just both no-op past whichever wins first.
    await mediaService.removeHostSession(roomId).catch(() => {});
    await roomService.forceEndRoom(roomId).catch(() => {});
    return { ...state, host: null };
  }

  // Within the grace window: same underlying session (still reusable by
  // publishHost the instant the real host reconnects) — just flagged here
  // so viewers can render a "reconnecting, Xs left" countdown instead of a
  // silent freeze or a hard error.
  return {
    ...state,
    host: {
      ...state.host,
      status: "reconnecting",
      reconnectDeadline: deadline,
    },
  };
}

/* ==========================================================================
 * AUDIO PARTY ROOM HELPERS
 * ======================================================================== */

/**
 * Bounded concurrency for audio joins. A popular host can send thousands of
 * people into a room within seconds; every join makes two provider calls
 * (create session + pull tracks). Letting all of them run at once would
 * saturate this process' sockets and trip provider-side limits, so joins are
 * admitted through a small semaphore and anything beyond the queue limit is
 * told to retry shortly (the client retries with jitter).
 */
const JOIN_MAX_CONCURRENT = 48;
const JOIN_MAX_QUEUE = 1500;
let joinActive = 0;
const joinQueue: Array<() => void> = [];

async function withJoinSlot<T>(task: () => Promise<T>): Promise<T> {
  if (joinActive >= JOIN_MAX_CONCURRENT) {
    if (joinQueue.length >= JOIN_MAX_QUEUE) {
      throw new AppError(503, "The party is very busy. Retrying…", {
        code: "MEDIA_JOIN_BUSY",
      });
    }
    await new Promise<void>((resolve) => joinQueue.push(resolve));
  } else {
    joinActive += 1;
  }

  try {
    return await task();
  } finally {
    const next = joinQueue.shift();
    if (next) {
      next(); // hand the slot straight to the next waiter
    } else {
      joinActive -= 1;
    }
  }
}

async function createAudioViewerSession(
  room: { id: string; host_id: string; media_type: string },
  userId: string,
  offerSdp: string,
  preview: boolean,
  mode: "listener" | "stage",
) {
  const roomId = room.id;

  if (room.host_id === userId) {
    throw new AppError(409, "Host cannot join as a viewer", {
      code: "HOST_CANNOT_BE_VIEWER",
    });
  }

  if (preview) {
    // Feed previews are a video-card feature; an audio room has nothing to
    // show and must not spend an SFU session on it.
    throw new AppError(409, "Audio rooms have no preview", {
      code: "MEDIA_PREVIEW_UNSUPPORTED",
    });
  }

  if (!stringValue(offerSdp)) {
    throw new AppError(400, "offerSdp is required", {
      code: "MEDIA_SDP_OFFER_REQUIRED",
    });
  }

  const hostRaw = await redis.hget(mediaKeys.media(roomId), "host");
  let host: {
    userId: string;
    sessionId: string;
    status: string;
    audioTrackName: string;
    mixTrackName?: string;
  } | null = null;
  try {
    host = typeof hostRaw === "string" ? JSON.parse(hostRaw) : null;
  } catch {
    host = null;
  }

  if (!host || host.status !== "connected") {
    throw new AppError(409, "Host media is not available yet", {
      code: "MEDIA_HOST_NOT_PUBLISHED",
    });
  }

  const provider = await mediaService.getProvider();
  const generation = await mediaService.getGeneration(roomId);

  const tracks: RemoteMediaTrack[] = [];

  if (mode === "stage") {
    /*
     * A seated speaker must not hear the host's pre-mix (it contains their
     * own voice, delayed). They listen to the raw host mic plus every OTHER
     * speaker's raw mic instead - at most 10 tracks, never scales with the
     * audience.
     */
    const seated = await roomState.isSpeaker(roomId, userId);
    if (!seated) {
      throw new AppError(403, "You are not on stage", {
        code: "ROOM_SPEAKER_NOT_APPROVED",
      });
    }

    tracks.push({
      sessionId: host.sessionId,
      trackName: host.audioTrackName,
    });

    const speakerEntries = (await redis.hgetall(
      mediaKeys.speakers(roomId),
    )) as Record<string, string>;

    for (const [speakerId, raw] of Object.entries(speakerEntries ?? {})) {
      if (speakerId === userId) continue;
      try {
        const speaker = JSON.parse(raw) as {
          sessionId: string;
          audioTrackName: string;
          status: string;
        };
        if (speaker.status !== "connected") continue;
        tracks.push({
          sessionId: speaker.sessionId,
          trackName: speaker.audioTrackName,
        });
      } catch {
        // Skip malformed entry.
      }
    }
  } else {
    // Listener: ONE track, the host's pre-mixed room audio. Falls back to
    // the raw mic if the host's browser could not build a mix.
    tracks.push({
      sessionId: host.sessionId,
      trackName: host.mixTrackName || host.audioTrackName,
    });
  }

  return withJoinSlot(async () => {
    // Drop any previous session this person still has open (reconnect,
    // second tab) so it can't leak SFU egress.
    const previousListener = await roomStageService.getListenerSession(
      roomId,
      userId,
    );
    if (previousListener) {
      provider.closeSession(previousListener).catch(() => {});
    }
    if (mode === "stage") {
      const previousViewer = await mediaService.getViewer(roomId, userId);
      if (previousViewer?.sessionId) {
        provider.closeSession(previousViewer.sessionId).catch(() => {});
      }
    }

    let session: MediaSession | null = null;

    const subscribe = async () => {
      const created = await provider.createSessionOnly({
        roomId,
        userId,
        role: "viewer",
        generation,
      });
      session = created.session;
      return provider.subscribeTracks({
        sessionId: created.session.sessionId,
        offerSdp,
        tracks,
      });
    };

    let negotiation: Awaited<ReturnType<typeof provider.subscribeTracks>>;

    try {
      try {
        negotiation = await subscribe();
      } catch (error) {
        if (!isStaleSessionError(error)) throw error;

        // A 410 on a session created a moment ago means one of the REMOTE
        // tracks (host / a speaker) is gone even though Redis still lists
        // it. Self-heal the stale entries so the client's retry is clean.
        if (session) {
          provider
            .closeSession((session as MediaSession).sessionId)
            .catch(() => {});
        }
        if (mode === "listener") {
          await redis.hdel(mediaKeys.media(roomId), "host").catch(() => {});
        }
        throw new AppError(
          503,
          "The live stream session is no longer available. Please try again in a moment.",
          { code: "MEDIA_HOST_SESSION_STALE" },
        );
      }

      if (!negotiation.answerSdp || !session) {
        throw new AppError(
          502,
          "Cloudflare did not return a viewer track negotiation answer",
          { code: "MEDIA_TRACK_SDP_MISSING" },
        );
      }

      const connected: MediaSession = {
        ...(session as MediaSession),
        status: "connected",
        preview: false,
        lastHeartbeatAt: Date.now(),
      };

      if (mode === "stage") {
        await mediaService.saveViewerSession(connected);
      } else {
        await roomStageService.saveListenerSession(
          roomId,
          userId,
          connected.sessionId,
        );
      }

      return {
        session: connected,
        answerSdp: negotiation.answerSdp,
        offerSdp: negotiation.offerSdp,
        tracks: negotiation.tracks,
        requiresRenegotiation: negotiation.requiresRenegotiation,
      };
    } catch (error) {
      if (session) {
        provider
          .closeSession((session as MediaSession).sessionId)
          .catch(() => {});
      }
      throw error;
    }
  });
}

/**
 * Drops speakers whose heartbeat has gone silent (closed tab, lost
 * network) so their seat doesn't stay taken forever. Only audio rooms:
 * seats there are a scarce, visible resource.
 */
async function reapDeadSpeakers(
  roomId: string,
  state: RoomMediaState,
): Promise<RoomMediaState> {
  const speakerIds = Object.keys(state.speakers);
  if (speakerIds.length === 0) return state;

  const dead = speakerIds.filter((id) => {
    const speaker = state.speakers[id];
    const beat = speaker.lastHeartbeatAt || speaker.joinedAt || 0;
    return Date.now() - beat > mediaConfig.session.staleAfterMs * 2;
  });

  if (dead.length === 0) return state;

  if ((await roomStageService.getMediaType(roomId)) !== "audio") return state;

  await Promise.all(
    dead.map((id) =>
      roomStageService.evictSpeaker(roomId, id).catch(() => {}),
    ),
  );

  const speakers = { ...state.speakers };
  for (const id of dead) delete speakers[id];
  return { ...state, speakers };
}