import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { FirehoseStats, FirehosePost } from '@/variants/types';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<FirehoseStats | null>(null);
  const [latestPost, setLatestPost] = useState<FirehosePost | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server with correct base path
    const socketInstance = io({
      path: `${import.meta.env.BASE_URL}socket.io`,
      transports: ['websocket', 'polling'],
    });

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

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return {
    socket,
    connected,
    stats,
    latestPost,
  };
}
