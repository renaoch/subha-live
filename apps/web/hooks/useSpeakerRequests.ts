import { useState, useEffect, useCallback, useRef } from 'react';
import { roomsApi, type SpeakerRequest } from '@/lib/api/rooms';
import { toast } from 'sonner';

export function useSpeakerRequests(roomId: string, isHost: boolean) {
  const [requests, setRequests] = useState<SpeakerRequest[]>([]);
  const [pending, setPending] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const list = await roomsApi.listSpeakerRequests(roomId);
      setRequests(list);
    } catch {
      // ignore
    }
  }, [roomId]);

  useEffect(() => {
    if (!isHost) return;
    fetchRequests();
    intervalRef.current = setInterval(fetchRequests, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHost, fetchRequests]);

  const requestAudio = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await roomsApi.requestAudio(roomId);
      toast.success('Audio seat requested');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setPending(false);
    }
  }, [roomId, pending]);

  const approve = useCallback(async (requestId: string) => {
    try {
      await roomsApi.approveSpeakerRequest(roomId, requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success('Viewer is joining the audio room');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  }, [roomId]);

  const reject = useCallback(async (requestId: string) => {
    try {
      await roomsApi.rejectSpeakerRequest(roomId, requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rejection failed');
    }
  }, [roomId]);

  return { requests, pending, requestAudio, approve, reject };
}