import { useEffect, useState, useRef } from 'react';
import { roomsApi, type RoomRecord } from '@/lib/api/rooms';

function isValidRoom(data: any): data is RoomRecord {
  return data && typeof data.id === 'string' && typeof data.host_id === 'string';
}

function createFallbackRoom(roomId: string): RoomRecord {
  return {
    id: roomId || 'demo-room',
    title: 'Subha Live',
    host_id: 'demo-host',
    status: 'live',
    category: 'Community',
    cover: '/image.png',
    description: 'This stream is awesome!',
    livekit_room_name: 'demo-room',
    max_guest_slots: 3,
    host: {
      id: 'demo-host',
      name: 'Subha',
      handle: 'subha',
      avatar: '/image.png',
      country_flag: null,
    },
    viewerCount: 1200,
    mediaType: 'video',
  };
}

export function useRoom(id: string) {
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRoom = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await roomsApi.get(id);
      if (isValidRoom(data)) {
        setRoom((prev) => {
          if (!prev || JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      } else {
        console.warn('[useRoom] Incomplete room data from API, using fallback', data);
        setRoom(createFallbackRoom(id));
      }
    } catch (error) {
      console.error('[useRoom] Failed to fetch room, using fallback:', error);
      setRoom(createFallbackRoom(id));
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoom(false);
    intervalRef.current = setInterval(() => fetchRoom(true), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  const refetch = () => fetchRoom(false);

  return { room, isLoading, refetch };
}