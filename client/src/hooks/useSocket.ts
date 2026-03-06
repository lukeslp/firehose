import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { FirehoseStats, FirehosePost } from '@/variants/types';

export function useSocket(sampleRate: number = 1) {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<FirehoseStats | null>(null);
  const [latestPost, setLatestPost] = useState<FirehosePost | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Disconnect previous socket if sample rate changed
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketInstance = io({
      path: `${import.meta.env.BASE_URL}socket.io`,
      transports: ['websocket', 'polling'],
      query: { sampleRate: String(sampleRate) },
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setConnected(false);
    });

    socketInstance.on('stats', (data: FirehoseStats) => {
      setStats(data);
    });

    socketInstance.on('post', (data: FirehosePost) => {
      setLatestPost(data);
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [sampleRate]);

  return { connected, stats, latestPost };
}
