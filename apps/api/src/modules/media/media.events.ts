import { randomUUID } from "node:crypto";

export type MediaEventType =
  | "host_started"
  | "host_stopped"
  | "host_reconnected"
  | "speaker_joined"
  | "speaker_left"
  | "speaker_video_enabled"
  | "speaker_video_disabled"
  | "viewer_joined"
  | "viewer_left"
  | "media_degraded"
  | "media_recovered"
  | "room_ending"
  | "room_ended"
  | "media_generation_changed";

export interface MediaEvent<
  TPayload = Record<string, unknown>,
> {
  eventId: string;

  roomId: string;

  sequence: number;

  generation: number;

  type: MediaEventType;

  timestamp: number;

  payload: TPayload;
}

export interface CreateMediaEventInput<
  TPayload = Record<string, unknown>,
> {
  roomId: string;

  sequence: number;

  generation: number;

  type: MediaEventType;

  payload: TPayload;
}

export function createMediaEvent<
  TPayload = Record<string, unknown>,
>(
  input: CreateMediaEventInput<TPayload>,
): MediaEvent<TPayload> {
  return {
    eventId: randomUUID(),
    roomId: input.roomId,
    sequence: input.sequence,
    generation: input.generation,
    type: input.type,
    timestamp: Date.now(),
    payload: input.payload,
  };
}

export function isMediaEvent(
  value: unknown,
): value is MediaEvent {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.eventId === "string" &&
    typeof event.roomId === "string" &&
    typeof event.sequence === "number" &&
    typeof event.generation === "number" &&
    typeof event.type === "string" &&
    typeof event.timestamp === "number" &&
    typeof event.payload === "object"
  );
}