import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// Compatibility shim for Node.js < 20 (replaces import.meta.dirname)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  base: '/bluesky/firehose/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(__dirname),
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client", "public"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "dr.eamer.dev",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
