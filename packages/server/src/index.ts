import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { listAgents } from "@shying/ds-science";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { isAllowedHost, isCrossOrigin } from "./host-guard.ts";
import { resourcePackageCatalog } from "./resource-package-catalog.ts";
import { resourceSkillCatalog } from "./resource-skill-catalog.ts";
import { registerSDKRoutes } from "./sdk-routes.ts";
import { listAvailableModels } from "./session.ts";
import { skillCatalog } from "./skill-catalog.ts";

const app = new Hono();
const webRoot = process.env.DEEPSCIENCE_WEB_ROOT ?? "packages/frontend/dist";

// ── Security middleware (loopback-only) ────────────────────────────────────────
// DNS-rebinding defense: only loopback Host headers are accepted.
// Cross-origin defense: foreign Origin or cross-site fetch is rejected.
app.use("*", async (c, next) => {
	const host = c.req.header("host") ?? new URL(c.req.url).host;
	if (!isAllowedHost(host)) {
		return c.json({ error: "Forbidden host" }, 403);
	}
	if (isCrossOrigin(c.req.header("origin"), c.req.header("sec-fetch-site"))) {
		return c.json({ error: "Forbidden origin" }, 403);
	}
	return next();
});

// CORS: only allow loopback origins
app.use(
	"*",
	cors({
		origin(input) {
			if (!input) return undefined;
			if (input.startsWith("http://localhost:") || input === "http://localhost") return input;
			if (input.startsWith("http://127.0.0.1:") || input === "http://127.0.0.1") return input;
			return undefined;
		},
	}),
);

// ── SDK-compatible DeepScience agent routes ──────────────────────────────────
registerSDKRoutes(app);

// ── Static frontend (fallback for production; Vite dev server handles dev) ────
// Register this after the API so every file emitted by Vite's public directory
// (logo, favicon, manifest, and future root assets) is available in packaged builds.
app.use("/*", serveStatic({ root: webRoot }));

// ── Start ────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3000);
const hostname = "127.0.0.1";
const modelCount = (await listAvailableModels()).length;
await skillCatalog.reload();
await resourceSkillCatalog.reload();
await resourcePackageCatalog.reload();
skillCatalog.startWatching();
resourceSkillCatalog.startWatching();
const skillStats = await skillCatalog.getStats();
const resourceSkillStats = await resourceSkillCatalog.getStats();
const resourcePackageCount = (await resourcePackageCatalog.list()).length;
console.log(`DeepScience server starting on http://${hostname}:${port}`);
console.log(`Agents: ${(await listAgents()).map((a) => a.name).join(", ")}`);
console.log(`Models available: ${modelCount}`);
console.log(`Skills available: ${skillStats.total} (${skillStats.sources.length} sources, hot reload enabled)`);
console.log(
	`Resources available: ${resourceSkillStats.total} top-level Skills, ${resourcePackageCount} database packages`,
);

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
	console.log(`Server running at http://${info.address}:${info.port}`);
	console.log(`DeepScience UI: http://localhost:${info.port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
	if (error.code === "EADDRINUSE") {
		console.error(
			`deepscience: Port ${port} is already in use. Start with another port, for example --port ${port + 1}.`,
		);
	} else {
		console.error(`deepscience: Failed to listen on ${hostname}:${port}: ${error.message}`);
	}
	process.exit(1);
});
