// File: apps/web/hooks/queries/use-profile.ts
//
// Second reference example of the pattern used in use-rooms.ts. "My
// profile" is fetched on tons of screens (profile tab, edit page, wallet
// header, level page). Without a shared cache, each one refetches
// independently on mount. With this hook, the first screen that mounts
// fetches it once, and every other screen on the same navigation gets it
// for free from cache -- instantly, then silently revalidated.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UpdateProfileInput } from "@/lib/api/users";

export const profileKeys = {
  me: ["profile", "me"] as const,
};

export function useMyProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: () => usersApi.me(),
    // Profile data changes rarely -- cache it longer than the default so
    // switching tabs never shows a loading flash.
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.updateMe(input),
    // Optimistic update: the edited fields show immediately, before the
    // network call resolves. If it fails, we roll back to the snapshot.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.me });
      const previous = queryClient.getQueryData(profileKeys.me);
      queryClient.setQueryData(profileKeys.me, (old: any) =>
        old ? { ...old, ...input } : old,
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKeys.me, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}
