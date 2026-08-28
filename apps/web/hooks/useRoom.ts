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
    viewerCount: 0, mediaType: "video",
  };
}

export function useRoom(id: string) {
  const query = useQuery({
    queryKey: ["rooms", "detail", id],
    queryFn: async () => {
      const data = await roomsApi.get(id);
      return isValidRoom(data) ? data : createFallbackRoom(id);
    },
    // One shared query per room prevents each component from creating its own poll.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
    retry: 2,
  });

  return {
    room: query.data ?? (query.isError ? createFallbackRoom(id) : null),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}