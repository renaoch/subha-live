import {
  cloudflareRealtimeProvider,
} from "../../lib/media/cloudflare/cloudflare-realtime";

import {
  createMediaService,
} from "./media.service";

export const mediaService =
  createMediaService({
    provider:
      cloudflareRealtimeProvider,
  });

export * from "./media.types";
export * from "./media.errors";
export * from "./media.events";
export * from "./media.constants";
export * from "./media.provider";
export * from "./media.state";
export * from "./media.service";