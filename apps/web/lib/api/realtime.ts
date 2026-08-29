import { createClient } from "@/lib/supabase/client";

// WebSocket base for the live-room realtime service. Falls back to nothing
// (realtime is optional — the UI degrades to polling) when unset.
const WS_BASE = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "";

/** Absolute WebSocket URL for the room's host-task event stream. */
export function taskWsUrl(roomId: string): string | null {
  if (!WS_BASE) return null;
  const base = WS_BASE.replace(/\/+$/, "");
  return `${base}/ws/rooms/${roomId}/task`;
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
