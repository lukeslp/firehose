import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { getFirehoseService } from './firehose';

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: '/socket.io'  // Caddy handle_path strips /bluesky/firehose prefix
  });

  const firehose = getFirehoseService();

  io.on('connection', (socket) => {
    // Read sample rate from handshake query (default: 1 = 100%)
    const rawRate = socket.handshake.query.sampleRate;
    const sampleRate = Math.min(1, Math.max(0.01, Number(rawRate) || 1));
    console.log(`[Socket.IO] Client connected: ${socket.id} (sample: ${(sampleRate * 100).toFixed(0)}%)`);

    // Send initial stats
    const stats = firehose.getStats();
    socket.emit('stats', stats);

    // Forward posts with sampling — stats always go through at full accuracy
    const handlePost = (post: any) => {
      if (sampleRate >= 1 || Math.random() < sampleRate) {
        socket.emit('post', post);
      }
    };

    const handleStats = () => {
      socket.emit('stats', firehose.getStats());
    };

    firehose.on('post', handlePost);

    // Stats every second (always full accuracy, not sampled)
    const statsInterval = setInterval(handleStats, 1000);

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
      firehose.off('post', handlePost);
      clearInterval(statsInterval);
    });
  });

  console.log('[Socket.IO] WebSocket server initialized');
  return io;
}
