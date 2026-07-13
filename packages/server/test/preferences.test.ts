import assert from "node:assert";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Hono } from "hono";
import { readPreferences, savePreferences } from "../src/preferences.ts";
import { registerSDKRoutes } from "../src/sdk-routes.ts";
import { listAvailableModels } from "../src/session.ts";

describe("DeepScience preferences", () => {
	let root = "";
	let previousDataDir: string | undefined;

	before(async () => {
		root = await mkdtemp(join(tmpdir(), "deepscience-preferences-"));
		previousDataDir = process.env.DEEPSCIENCE_DATA_DIR;
		process.env.DEEPSCIENCE_DATA_DIR = root;
	});

	after(async () => {
		if (previousDataDir === undefined) delete process.env.DEEPSCIENCE_DATA_DIR;
		else process.env.DEEPSCIENCE_DATA_DIR = previousDataDir;
		await rm(root, { recursive: true, force: true });
	});

	it("persists partial updates without clearing another preference", async () => {
		assert.deepStrictEqual(await readPreferences(), {});
		await savePreferences({ defaultAgent: "biology" });
		await savePreferences({ defaultModel: { provider: "zai", id: "glm-test", name: "GLM Test" } });

		const saved = await readPreferences();
		assert.strictEqual(saved.defaultAgent, "biology");
		assert.deepStrictEqual(saved.defaultModel, { provider: "zai", id: "glm-test", name: "GLM Test" });
		assert.strictEqual(typeof saved.updatedAt, "number");
		assert.strictEqual((await stat(join(root, "settings.json"))).mode & 0o777, 0o600);
		assert.match(await readFile(join(root, "settings.json"), "utf8"), /"glm-test"/);
	});

	it("validates and serves model preferences through the API", async () => {
		const model = (await listAvailableModels())[0];
		assert.ok(model);
		const app = new Hono();
		registerSDKRoutes(app);

		const update = await app.request("/api/preferences", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ defaultAgent: "biology", defaultModel: { provider: model.provider, id: model.id } }),
		});
		assert.strictEqual(update.status, 200);
		const updated = (await update.json()) as {
			defaultAgent?: string;
			defaultModel?: { provider: string; id: string; name: string };
		};
		assert.strictEqual(updated.defaultAgent, "biology");
		assert.deepStrictEqual(updated.defaultModel, { provider: model.provider, id: model.id, name: model.name });

		const fetched = await app.request("/api/preferences");
		assert.strictEqual(fetched.status, 200);
		assert.deepStrictEqual(((await fetched.json()) as { defaultModel?: unknown }).defaultModel, updated.defaultModel);

		const invalid = await app.request("/api/preferences", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ defaultModel: { provider: "missing", id: "missing" } }),
		});
		assert.strictEqual(invalid.status, 422);
	});
});
