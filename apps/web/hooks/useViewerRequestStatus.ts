import { useState, useEffect, useRef } from 'react';
import { roomsApi } from '@/lib/api/rooms';
import { toast } from 'sonner';

export function useViewerRequestStatus(
  roomId: string,
  isHost: boolean,
  userId: string | null,
  roomStatus?: string | null,
) {
  const [isPending, setIsPending] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const hasShownToast = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only poll while the room is actually live — a created/ended room has no
    // meaningful request state, so this avoids a needless 2s poll per viewer.
    if (isHost || !roomId || !userId || roomStatus !== 'live') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPending(false);
      setIsAccepted(false);
      hasShownToast.current = false;
      return;
    }
    let active = true;

    const checkStatus = async () => {
      try {
        const status = await roomsApi.getMyRequestStatus(roomId);
        if (!active) return;

        if (status.status === 'accepted') {
          setIsPending(false);
          setIsAccepted(true);
          if (!hasShownToast.current) {
            hasShownToast.current = true;
            toast.success('Your audio seat was accepted');
          }
        } else if (status.status === 'pending') {
          setIsPending(true);
          setIsAccepted(false);
          hasShownToast.current = false;
        } else {
          setIsPending(false);
          setIsAccepted(false);
          hasShownToast.current = false;
        }
      } catch (error) {
        console.error('[ViewerRequestStatus] Failed to fetch status:', error);
        if (!hasShownToast.current) {
          toast.error('Could not check your request status');
          hasShownToast.current = true;
        }
      }
    };

    checkStatus();
    intervalRef.current = setInterval(checkStatus, 2000);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [roomId, isHost, userId, roomStatus]);

  return { isPending, isAccepted };
}