import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupSocketIO } from "../socketio";
import { getFirehoseService } from "../firehose";
import { getProfileEnricher } from "../profileEnricher";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback at root (Caddy strips /bluesky/firehose prefix)
  registerOAuthRoutes(app);

  // tRPC API at root (Caddy strips /bluesky/firehose prefix)
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const host = process.env.HOST || "127.0.0.1";
  // Production binds a fixed loopback port (Caddy reverse_proxy). Dev may
  // still search upward if the preferred port is taken.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Setup Socket.IO
  setupSocketIO(server);

  // Kick off profile enrichment — it batches author DIDs seen on broadcast
  // and emits 'profile' events that Socket.IO forwards to every client.
  const profileEnricher = getProfileEnricher();
  profileEnricher.start();

  const shutdown = () => {
    profileEnricher.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);

    // Firehose auto-starts in its constructor - no manual start needed
    console.log('[Server] Firehose will auto-start on service initialization');
  });
}

startServer().catch(console.error);
