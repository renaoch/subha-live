import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { mediaService } from "../media";
import { mediaConfig } from "../../config/media.config";
import { roomState } from "./room-state.service";
import type {
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
  const track = tracks.find((item) => item.kind === kind);
  if (!track) {
    throw new AppError(400, `A ${kind} track is required`, {
      code: `MEDIA_${kind.toUpperCase()}_TRACK_REQUIRED`,
    });
  }
  return track;
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, host_id, status, max_guest_slots")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to fetch room", {
      code: "ROOM_FETCH_FAILED",
      details: error.message,
    });
  }

  if (!data) {
    throw new AppError(404, "Room not found", {
      code: "ROOM_NOT_FOUND",
    });
  }

  if (data.status !== "live") {
    throw new AppError(409, "Room is not live", {
      code: "ROOM_NOT_LIVE",
    });
  }

  return data;
}

export const roomMediaService = {
  async getState(roomId: string) {
    return mediaService.getRoomState(roomId);
  },

  async publishHost(
    roomId: string,
    userId: string,
    offerSdp: string,
    tracks: MediaTrack[],
  ) {
    const room = await getRoom(roomId);
    if (room.host_id !== userId) {
      throw new AppError(403, "Only the room host can publish", {
        code: "ROOM_HOST_REQUIRED",
      });
    }

    if (!offerSdp.trim()) {
      throw new AppError(400, "offerSdp is required", {
        code: "MEDIA_SDP_OFFER_REQUIRED",
      });
    }

    const video = requireTrack(tracks, "video");
    const audio = requireTrack(tracks, "audio");
    const generation = await mediaService.getGeneration(roomId);

    if (generation <= 0) {
      throw new AppError(409, "Media room has not been initialized", {
        code: "MEDIA_ROOM_NOT_INITIALIZED",
      });
    }

    const existing = await mediaService.getRoomState(roomId);
    if (existing.host && existing.host.userId !== userId) {
      throw new AppError(409, "A host is already publishing in this room", {
        code: "MEDIA_HOST_ALREADY_PUBLISHED",
      });
    }

    const provider = await mediaService.getProvider();
    const sessionResult = await provider.createSession({
        roomId,
        userId,
        role: "host",
        generation,
        offerSdp,
      });

    try {
      const negotiation = await provider.publishTracks({
        sessionId: sessionResult.session.sessionId,
        offerSdp,
        tracks: [audio, video],
      });

      await mediaService.saveHostSession(
        sessionResult.session,
        video.trackName,
        audio.trackName,
      );
      await mediaService.setRoomStatus(roomId, "live");

      return {
        session: sessionResult.session,
        answerSdp: negotiation.answerSdp,
        tracks: negotiation.tracks,
        requiresRenegotiation: negotiation.requiresRenegotiation,
      };
    } catch (error) {
      await provider.closeSession(sessionResult.session.sessionId)
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
    await getRoom(roomId);

    if (!offerSdp.trim()) {
      throw new AppError(400, "offerSdp is required", {
        code: "MEDIA_SDP_OFFER_REQUIRED",
      });
    }

    if (!(await roomState.isSpeaker(roomId, userId))) {
      throw new AppError(403, "You do not have an approved speaker slot", {
        code: "SPEAKER_SLOT_REQUIRED",
      });
    }

    const hasVideo = await roomState.isVideoSpeaker(roomId, userId);
    const audio = requireTrack(tracks, "audio");
    const video = tracks.find((track) => track.kind === "video");

    if (hasVideo && !video) {
      throw new AppError(400, "Your approved slot includes video", {
        code: "VIDEO_TRACK_REQUIRED",
      });
    }

    if (!hasVideo && video) {
      throw new AppError(403, "You do not have the video slot", {
        code: "VIDEO_SLOT_NOT_ASSIGNED",
      });
    }

    const generation = await mediaService.getGeneration(roomId);
    const provider = await mediaService.getProvider();
    const sessionResult = await provider.createSession({
      roomId,
      userId,
      role: "speaker",
      generation,
      offerSdp,
    });

    try {
      const publishTracks = video ? [audio, video] : [audio];
      const negotiation = await provider.publishTracks({
        sessionId: sessionResult.session.sessionId,
        offerSdp,
        tracks: publishTracks,
      });

      await mediaService.saveSpeakerSession(
        sessionResult.session,
        audio.trackName,
        video?.trackName,
      );

      return {
        session: sessionResult.session,
        hasVideo,
        answerSdp: negotiation.answerSdp,
        tracks: negotiation.tracks,
        requiresRenegotiation: negotiation.requiresRenegotiation,
      };
    } catch (error) {
      await provider.closeSession(sessionResult.session.sessionId)
        .catch(() => {});
      throw error;
    }
  },

  async unpublishGuest(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const state = await mediaService.getRoomState(roomId);
    const speaker = state.speakers[userId];

    if (speaker?.sessionId) {
      const provider = await mediaService.getProvider();
      await provider.closeSession(speaker.sessionId)
        .catch(() => {});
    }

    await mediaService.removeSpeakerSession(roomId, userId);
    await roomState.removeVideoSpeaker(roomId, userId);
    await roomState.removeSpeaker(roomId, userId);
  },

  async createViewerSession(
    roomId: string,
    userId: string,
    offerSdp: string,
  ) {
    const room = await getRoom(roomId);
    if (room.host_id === userId) {
      throw new AppError(409, "Host cannot join as a viewer", {
        code: "HOST_CANNOT_BE_VIEWER",
      });
    }

    if (!offerSdp.trim()) {
      throw new AppError(400, "offerSdp is required", {
        code: "MEDIA_SDP_OFFER_REQUIRED",
      });
    }

    const state = await mediaService.getRoomState(roomId);
    if (!state.host) {
      throw new AppError(409, "Host media is not available", {
        code: "MEDIA_HOST_NOT_PUBLISHED",
      });
    }

    const tracks: RemoteMediaTrack[] = [
      {
        sessionId: state.host.sessionId,
        trackName: state.host.videoTrackName,
      },
      {
        sessionId: state.host.sessionId,
        trackName: state.host.audioTrackName,
      },
    ];

    for (const speaker of Object.values(state.speakers)) {
      tracks.push({
        sessionId: speaker.sessionId,
        trackName: speaker.audioTrackName,
      });

      if (speaker.videoTrackName) {
        tracks.push({
          sessionId: speaker.sessionId,
          trackName: speaker.videoTrackName,
        });
      }
    }

    const generation = state.generation;
    const provider = await mediaService.getProvider();
    const sessionResult = await provider.createSession({
      roomId,
      userId,
      role: "viewer",
      generation,
      offerSdp,
    });

    try {
      const negotiation = await provider.subscribeTracks({
        sessionId: sessionResult.session.sessionId,
        offerSdp,
        tracks,
      });

      await mediaService.saveViewerSession(sessionResult.session);

      return {
        session: sessionResult.session,
        answerSdp: negotiation.answerSdp,
        offerSdp: negotiation.offerSdp,
        tracks: negotiation.tracks,
        requiresRenegotiation: negotiation.requiresRenegotiation,
      };
    } catch (error) {
      await provider.closeSession(sessionResult.session.sessionId)
        .catch(() => {});
      throw error;
    }
  },

  async completeRenegotiation(
    roomId: string,
    userId: string,
    answerSdp: string,
  ) {
    const state = await mediaService.getRoomState(roomId);
    const viewer = state.viewers?.[userId];
    const speaker = state.speakers[userId];
    const sessionId = viewer?.sessionId ?? speaker?.sessionId;

    if (!sessionId) {
      throw new AppError(404, "Media session not found", {
        code: "MEDIA_SESSION_NOT_FOUND",
      });
    }

    const provider = await mediaService.getProvider();
    await provider.renegotiate({
      sessionId,
      answerSdp,
    });
  },

  async leaveViewer(roomId: string, userId: string): Promise<void> {
    const state = await mediaService.getRoomState(roomId);
    const viewer = state.viewers[userId];

    if (viewer?.sessionId) {
      const provider = await mediaService.getProvider();
      await provider.closeSession(viewer.sessionId)
        .catch(() => {});
    }

    await mediaService.removeViewerSession(roomId, userId);
  },

  async heartbeat(
    roomId: string,
    userId: string,
    role: "host" | "speaker" | "viewer",
    sessionId: string,
    generation: number,
  ) {
    await mediaService.heartbeat(
      roomId,
      userId,
      role,
      sessionId,
      generation,
    );
  },

  async shutdownRoom(roomId: string): Promise<void> {
    const state = await mediaService.getRoomState(roomId);
    await mediaService.setRoomStatus(roomId, "ending");

    const provider = await mediaService.getProvider();
    const sessionIds = new Set<string>();
    if (state.host?.sessionId) sessionIds.add(state.host.sessionId);
    for (const speaker of Object.values(state.speakers)) {
      if (speaker.sessionId) sessionIds.add(speaker.sessionId);
    }
    for (const viewer of Object.values(state.viewers)) {
      if (viewer.sessionId) sessionIds.add(viewer.sessionId);
    }

    await Promise.all(
      [...sessionIds].map((sessionId) =>
        provider.closeSession(sessionId).catch(() => {}),
      ),
    );

    await mediaService.incrementGeneration(roomId);
    await mediaService.setRoomStatus(roomId, "ended");
    await mediaService.clearParticipants(roomId);
    await roomState.clear(roomId);


  },
};
