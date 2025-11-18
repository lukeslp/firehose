import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Compatibility shim for Node.js < 20 (replaces import.meta.dirname)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // When running built code with node dist/index.js, __dirname is dist/
  // We need to go to dist/public (which is just ./public from dist/)
  const distPath = path.resolve(__dirname, "public");

  console.log(`[Static] __dirname: ${__dirname}`);
  console.log(`[Static] distPath: ${distPath}`);
  console.log(`[Static] distPath exists: ${fs.existsSync(distPath)}`);

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    return;
  }

  // List files in distPath for debugging
  const files = fs.readdirSync(distPath);
  console.log(`[Static] Files in distPath:`, files);

  // Serve static files from root
  // Caddy handle_path strips /bluesky/firehose, so when browser requests:
  //   /bluesky/firehose/assets/index.js -> Express receives: /assets/index.js
  // We serve from root to match what Caddy sends us
  app.use((req, res, next) => {
    console.log(`[Static] Request: ${req.method} ${req.url}`);
    next();
  });
  app.use(express.static(distPath));
  console.log(`[Static] Registered static middleware at root for: ${distPath}`);

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    console.log(`[Static] Serving index.html for: ${_req.originalUrl}`);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
