export interface CloudflareSessionDescription {
  type: "offer" | "answer";

  sdp: string;
}

export interface CloudflareSessionResponse {
  sessionId: string;

  sessionDescription?: CloudflareSessionDescription;

  errorCode?: string;

  errorDescription?: string;
}

export interface CloudflareTrack {
  location: "local" | "remote";

  mid?: string;

  trackName: string;

  sessionId?: string;
}

export interface CloudflareTracksResponse {
  sessionDescription?: CloudflareSessionDescription;

  tracks: CloudflareTrack[];

  requiresImmediateRenegotiation?: boolean;
}

export interface CloudflareSessionInfo {
  sessionId?: string;

  status?: string;

  tracks?: CloudflareTrack[];

  [key: string]: unknown;
}

export interface CloudflareApiErrorResponse {
  error?: string;

  message?: string;

  code?: string | number;

  [key: string]: unknown;
}