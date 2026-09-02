import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { getFirehoseService } from './firehose';
import { getProfileEnricher } from './profileEnricher';

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: '/socket.io'  // Caddy handle_path strips /bluesky/firehose prefix
  });

  const firehose = getFirehoseService();
  const enricher = getProfileEnricher();

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (full stream)`);

    // Send initial stats
    const stats = firehose.getStats();
    socket.emit('stats', stats);
    const profiles = enricher.snapshot();
    if (profiles.length > 0) socket.emit('profile', profiles);

    // The spectacle is the product: every received post is forwarded and the
    // transport is never sampled by default.
    const handlePost = (post: any) => socket.emit('post', post);

    const handleStats = () => {
      socket.emit('stats', firehose.getStats());
    };
    const handleProfile = (batch: unknown) => socket.emit('profile', batch);

    firehose.on('post', handlePost);
    enricher.on('profile', handleProfile);

    // Stats every second (always full accuracy, not sampled)
    const statsInterval = setInterval(handleStats, 1000);

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
      firehose.off('post', handlePost);
      enricher.off('profile', handleProfile);
      clearInterval(statsInterval);
    });
  });

  console.log('[Socket.IO] WebSocket server initialized');
  return io;
}
