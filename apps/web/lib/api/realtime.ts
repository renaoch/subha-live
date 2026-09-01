import { createClient } from "@/lib/supabase/client";

// WebSocket base for the live-room realtime service. Falls back to nothing
// (realtime is optional — the UI degrades to polling) when unset.
const WS_BASE = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "";
// HTTP base for the same service (history endpoint). Derived from the WS base
// when a dedicated HTTP URL isn't configured.
const HTTP_BASE =
  process.env.NEXT_PUBLIC_REALTIME_HTTP_URL ||
  WS_BASE.replace(/^ws:/, "http:").replace(/^wss:/, "https:");

/** Absolute WebSocket URL for the room's host-task event stream. */
export function taskWsUrl(roomId: string): string | null {
  if (!WS_BASE) return null;
  const base = WS_BASE.replace(/\/+$/, "");
  return `${base}/ws/rooms/${roomId}/task`;
}

/** Absolute WebSocket URL for the room's chat stream. */
export function chatWsUrl(roomId: string): string | null {
  if (!WS_BASE) return null;
  const base = WS_BASE.replace(/\/+$/, "");
  return `${base}/ws/rooms/${roomId}/chat`;
}

/** Absolute HTTP URL for the room's chat history endpoint. */
export function chatHistoryUrl(roomId: string): string | null {
  if (!HTTP_BASE) return null;
  const base = HTTP_BASE.replace(/\/+$/, "");
  return `${base}/rooms/${roomId}/chat/history`;
}

/** Absolute WebSocket URL for a PK battle's live state stream. */
export function pkBattleWsUrl(battleId: string): string | null {
  if (!WS_BASE) return null;
  const base = WS_BASE.replace(/\/+$/, "");
  return `${base}/ws/pk/${battleId}`;
}

/** Absolute WebSocket URL for a host's directed PK events (invite/accept/decline). */
export function pkHostWsUrl(hostId: string): string | null {
  if (!WS_BASE) return null;
  const base = WS_BASE.replace(/\/+$/, "");
  return `${base}/ws/pk/host/${hostId}`;
}

/** Current Supabase access token (for the realtime service's JWT auth). */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

