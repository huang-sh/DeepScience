import assert from "node:assert";
import { describe, it } from "node:test";
import { Hono } from "hono";
import { registerSDKRoutes } from "../src/sdk-routes.ts";

describe("DeepScience capability contract", () => {
	it("reports the active brand and supported workspace surfaces", async () => {
		const app = new Hono();
		registerSDKRoutes(app);
		const response = await app.request("/api/capabilities");
		const body = (await response.json()) as {
			brand: string;
			runtime: { agent: string; model: string; extensions: boolean; sessionAuthority: string };
			features: Record<string, boolean>;
			settings: Record<string, boolean | string>;
		};

		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.brand, "DeepScience");
		assert.deepStrictEqual(body.runtime, {
			agent: "pi-coding-agent",
			model: "pi-ai",
			extensions: true,
			sessionAuthority: "deepscience",
		});
		assert.strictEqual(body.features.sessions, true);
		assert.strictEqual(body.features.researchGraph, false);
		assert.strictEqual(body.features.fileBrowsing, true);
		assert.strictEqual(body.features.projectWorkspaces, true);
		assert.strictEqual(body.features.gitWorktrees, true);
		assert.strictEqual(body.features.providerOAuth, true);
		assert.strictEqual(body.features.pty, false);
		assert.strictEqual(body.settings.capabilities, true);
		assert.strictEqual(body.settings.skills, true);
		assert.strictEqual(body.settings.general, "appearance-only");
		assert.strictEqual(body.settings.credentials, false);
	});
});
