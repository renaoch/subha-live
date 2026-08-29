import { useState, useEffect, useCallback, useRef } from 'react';
import { roomTasksApi, type RoomTask, type SetRoomTaskInput } from '@/lib/api/room-tasks';
import { toast } from 'sonner';

/**
 * Tracks the room's live task/goal for both the host and viewers.
 *
 * Polls every 2s while the room is waiting/live (same cadence as
 * useSpeakerRequests) so the progress bar in the header feels
 * real-time without needing a Supabase realtime channel.
 */
export function useRoomTask(roomId: string, roomStatus?: string | null) {
  const [task, setTaskState] = useState<RoomTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<RoomTask['status'] | null>(null);
  // Ref (not state) so a second click fired before React re-renders is
  // still blocked synchronously — belt-and-suspenders on top of the
  // server-side idempotent claim, which is the real guarantee.
  const claimInFlightRef = useRef(false);

  const fetchTask = useCallback(async () => {
    if (!roomId) return;

    try {
      const result = await roomTasksApi.getTask(roomId);
      setTaskState(result);
    } catch (e) {
      console.error('[useRoomTask] failed to fetch task:', e);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || (roomStatus !== 'live' && roomStatus !== 'created')) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchTask();
    intervalRef.current = setInterval(fetchTask, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [roomId, roomStatus, fetchTask]);

  // Celebrate the moment a goal is completed, once, for whoever's watching.
  useEffect(() => {
    if (task?.status === 'completed' && prevStatusRef.current === 'active') {
      toast.success(`Goal reached: ${task.title}! 🎉`);
    }
    prevStatusRef.current = task?.status ?? null;
  }, [task?.status, task?.title]);

  const setTask = useCallback(
    async (input: SetRoomTaskInput) => {
      setSaving(true);
      try {
        const created = await roomTasksApi.setTask(roomId, input);
        setTaskState(created);
        toast.success('Task is live for viewers');
        return created;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to set task');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [roomId],
  );

  const cancelTask = useCallback(async () => {
    setSaving(true);
    try {
      await roomTasksApi.cancelTask(roomId);
      setTaskState(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel task');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [roomId]);

  const claim = useCallback(async () => {
    if (!roomId || claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    setClaiming(true);
    try {
      const result = await roomTasksApi.claim(roomId);
      // Optimistically mark claimed locally; the next poll tick will
      // reconcile with the server anyway, but this avoids a flash of the
      // CLAIM button reappearing while that request is in flight.
      setTaskState((prev) =>
        prev ? { ...prev, isClaimed: true, claimedAt: result.claimedAt } : prev,
      );
      toast.success(`+${result.rewardCoins} coins added to your balance!`);
      await fetchTask();
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to claim reward';
      // Already-claimed is not really an error from the user's point of
      // view (e.g. they claimed in another tab) — just resync silently.
      if (message.toLowerCase().includes('already claimed')) {
        await fetchTask();
      } else {
        toast.error(message);
      }
      throw e;
    } finally {
      claimInFlightRef.current = false;
      setClaiming(false);
    }
  }, [roomId, fetchTask]);

  return { task, saving, claiming, setTask, cancelTask, claim, refetch: fetchTask };
}
