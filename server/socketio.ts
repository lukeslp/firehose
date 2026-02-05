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
    console.log('[Socket.IO] Client connected:', socket.id);

    // Send initial stats
    const stats = firehose.getStats();
    socket.emit('stats', stats);

    // Listen for firehose events and broadcast to clients
    const handlePost = (post: any) => {
      socket.emit('post', post);
    };

    const handleStats = () => {
      const currentStats = firehose.getStats();
      socket.emit('stats', currentStats);
    };

    // Attach listeners
    firehose.on('post', handlePost);

    // Send stats updates every second
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
