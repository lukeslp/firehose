import { useCallback, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BskyProfile, FirehoseStats, FirehosePost } from '@/variants/types';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<FirehoseStats | null>(null);
  const [postBatch, setPostBatch] = useState<FirehosePost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, BskyProfile>>({});
  const socketRef = useRef<Socket | null>(null);
  const pendingPosts = useRef<FirehosePost[]>([]);
  const pendingFrame = useRef<number | null>(null);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketInstance = io({
      path: `${import.meta.env.BASE_URL}socket.io`,
      transports: ['websocket', 'polling'],
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
      pendingPosts.current.push(data);
      if (pendingFrame.current !== null) return;
      pendingFrame.current = window.requestAnimationFrame(() => {
        pendingFrame.current = null;
        const framePosts = pendingPosts.current.splice(0);
        setPostBatch(previous => previous.concat(framePosts));
      });
    });
    socketInstance.on('profile', (batch: BskyProfile[]) => {
      setProfiles(previous => {
        const next = { ...previous };
        batch.forEach(profile => { next[profile.did] = profile; });
        return next;
      });
    });

    return () => {
      socketInstance.disconnect();
      if (pendingFrame.current !== null) window.cancelAnimationFrame(pendingFrame.current);
      pendingPosts.current = [];
      pendingFrame.current = null;
      socketRef.current = null;
    };
  }, []);

  const acknowledgePostBatch = useCallback((count: number) => {
    setPostBatch(previous => previous.slice(count));
  }, []);

  return { connected, stats, postBatch, acknowledgePostBatch, profiles };
}
