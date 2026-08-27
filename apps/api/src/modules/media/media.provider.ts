import type {
  CloseTracksInput,
  CreateMediaSessionInput,
  CreateMediaSessionResult,
  MediaNegotiationResult,
  MediaSessionInfo,
  PublishTracksInput,
  RenegotiateInput,
  SubscribeTracksInput,
  UpdateTracksInput,
} from "./media.types";

export interface MediaProvider {
  createSession(
    input: CreateMediaSessionInput,
  ): Promise<CreateMediaSessionResult>;

  /** Create a Cloudflare session without negotiating media. */
  createSessionOnly(
    input: CreateMediaSessionInput,
  ): Promise<CreateMediaSessionResult>;

  publishTracks(
    input: PublishTracksInput,
  ): Promise<MediaNegotiationResult>;

  subscribeTracks(
    input: SubscribeTracksInput,
  ): Promise<MediaNegotiationResult>;

  renegotiate(
    input: RenegotiateInput,
  ): Promise<void>;

  closeTracks(
    input: CloseTracksInput,
  ): Promise<void>;

  updateTracks(
    input: UpdateTracksInput,
  ): Promise<void>;

  getSession(
    sessionId: string,
  ): Promise<MediaSessionInfo>;

  closeSession(
    sessionId: string,
  ): Promise<void>;
}