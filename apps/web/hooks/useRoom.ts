import { useQuery } from "@tanstack/react-query";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";

function isValidRoom(data: unknown): data is RoomRecord {
  return Boolean(data && typeof data === "object" && "id" in data && "host_id" in data);
}

function createFallbackRoom(roomId: string): RoomRecord {
  return {
    id: roomId || "demo-room", title: "Subha Live", host_id: "demo-host", status: "live",
    category: "Community", cover: "/image.png", description: "This stream is awesome!",
    livekit_room_name: "demo-room", max_guest_slots: 3,
    host: { id: "demo-host", name: "Subha", handle: "subha", avatar: "/image.png", country_flag: null },
    viewerCount: 0, media_type: "video",
  };
}

// True only when the backend/Supabase env vars are missing, i.e. we're
// running with no real API to talk to at all (local/demo preview). This is
// the ONLY case where fabricating a fake "live" room is safe — because
// there is no real room, and therefore no auto-join call, that can be
// silently pointed at a fake "live" status.
function isBackendUnconfigured(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("is not configured in this deployment")
  );
}

export function useRoom(id: string) {
  const query = useQuery({
    queryKey: ["rooms", "detail", id],
    queryFn: async () => {
      try {
        const data = await roomsApi.get(id);
        return isValidRoom(data) ? data : createFallbackRoom(id);
      } catch (error) {
        // Only fabricate a demo room when there's genuinely no backend to
        // call. Any real failure (room not found, unauthorized, network
        // error, server error, transient blip) must propagate as a real
        // error instead of being disguised as a live room — a viewer page
        // that silently swaps in `status: "live"` on failure will
        // auto-join against the real room id anyway, producing confusing
        // "join failed" errors (or a permanently stuck loading state)
        // with no sign that the actual problem was this GET failing.
        if (isBackendUnconfigured(error)) {
          return createFallbackRoom(id);
        }
        throw error;
      }
    },
    // One shared query per room prevents each component from creating its own poll.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
    retry: 2,
  });

  return {
    room: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}