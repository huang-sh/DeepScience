import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vite"

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3000"
// Large research workspaces and remote IDEs can exhaust the per-user inotify
// budget before Vite starts. Polling keeps `npm run dev` reliable; opt back in
// to native watchers with DEEPSCIENCE_WATCH_POLLING=0 when the host has room.
const USE_POLLING = process.env.DEEPSCIENCE_WATCH_POLLING !== "0"

// Routes the DeepScience server exposes (no /api prefix on most).
const proxyPaths = [
  "/session", "/agent", "/config", "/project", "/provider",
  "/global", "/file", "/event", "/command", "/find",
  "/api", "/pty", "/vcs", "/path", "/instance",
  "/experimental", "/log", "/mcp", "/lsp", "/formatter",
  "/auth",
]

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5175,
    watch: USE_POLLING ? { usePolling: true, interval: 500 } : undefined,
    proxy: Object.fromEntries(
      proxyPaths.map((p) => [p, { target: BACKEND, changeOrigin: true }]),
    ),
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
})
