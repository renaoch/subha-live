// File: apps/web/hooks/queries/use-rooms.ts
//
// Replaces the old `useEffect + setInterval + setState` polling pattern.
// React Query's `refetchInterval` does the same background polling, but:
//   - it dedupes: if two components use this hook at once, only 1 request fires
//   - it doesn't unmount/remount the loading state on every refetch (no flicker)
//   - the cached list is shown instantly when navigating back to this screen
//   - it pauses polling automatically when the tab is hidden (saves battery/data)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomsApi, type CreateRoomInput, type RoomRecord } from "@/lib/api/rooms";

export const roomsKeys = {
  all: ["rooms"] as const,
  list: () => [...roomsKeys.all, "list"] as const,
};

export function useRooms() {
  return useQuery({
    queryKey: roomsKeys.list(),
    queryFn: () => roomsApi.list(),
    // Background refresh every 5s, same cadence as before, but now it's a
    // silent revalidation (isFetching flips, isLoading/data do not reset).
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomsApi.create(input),
    onSuccess: (room) => {
      // Optimistically drop the new room into the cache so it appears
      // instantly, instead of waiting for the next 5s poll.
      queryClient.setQueryData<RoomRecord[]>(roomsKeys.list(), (old) =>
        old ? [room, ...old] : [room],
      );
      queryClient.invalidateQueries({ queryKey: roomsKeys.list() });
    },
  });
}
