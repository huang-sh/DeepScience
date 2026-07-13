import assert from "node:assert";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Hono } from "hono";
import { registerSDKRoutes } from "../src/sdk-routes.ts";

describe("DeepScience provider credentials", () => {
	let root = "";
	let previousDataDir: string | undefined;
	let previousOpenAIKey: string | undefined;
	let previousBigModelKey: string | undefined;
	let previousZhipuAIKey: string | undefined;

	before(async () => {
		root = await mkdtemp(join(tmpdir(), "deepscience-credentials-"));
		previousDataDir = process.env.DEEPSCIENCE_DATA_DIR;
		previousOpenAIKey = process.env.OPENAI_API_KEY;
		previousBigModelKey = process.env.BIGMODEL_API_KEY;
		previousZhipuAIKey = process.env.ZHIPUAI_API_KEY;
		process.env.DEEPSCIENCE_DATA_DIR = root;
		delete process.env.OPENAI_API_KEY;
		delete process.env.BIGMODEL_API_KEY;
		delete process.env.ZHIPUAI_API_KEY;
	});

	after(async () => {
		if (previousDataDir === undefined) delete process.env.DEEPSCIENCE_DATA_DIR;
		else process.env.DEEPSCIENCE_DATA_DIR = previousDataDir;
		if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = previousOpenAIKey;
		if (previousBigModelKey === undefined) delete process.env.BIGMODEL_API_KEY;
		else process.env.BIGMODEL_API_KEY = previousBigModelKey;
		if (previousZhipuAIKey === undefined) delete process.env.ZHIPUAI_API_KEY;
		else process.env.ZHIPUAI_API_KEY = previousZhipuAIKey;
		await rm(root, { recursive: true, force: true });
	});

	it("stores keys securely without returning them and filters models immediately", async () => {
		const app = new Hono();
		registerSDKRoutes(app);
		const secret = "test-openai-key-never-return";

		const saved = await app.request("/api/providers/openai/api-key", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: secret }),
		});
		assert.strictEqual(saved.status, 200);
		assert.doesNotMatch(await saved.clone().text(), new RegExp(secret));

		const providers = (await saved.json()) as {
			providers: Array<{
				id: string;
				name: string;
				configured: boolean;
				stored: boolean;
				source?: string;
				envVariable?: string;
				modelCount: number;
				manageable: boolean;
				oauthSupported: boolean;
				oauthName?: string;
				oauthStored: boolean;
			}>;
		};
		const openai = providers.providers.find((provider) => provider.id === "openai");
		assert.ok(openai);
		assert.strictEqual(openai.name, "OpenAI");
		assert.strictEqual(openai.configured, true);
		assert.strictEqual(openai.stored, true);
		assert.strictEqual(openai.source, "stored credential");
		assert.strictEqual(openai.envVariable, "OPENAI_API_KEY");
		assert.strictEqual(openai.manageable, true);
		assert.ok(openai.modelCount > 0);
		assert.strictEqual(openai.oauthSupported, false);

		const codex = providers.providers.find((provider) => provider.id === "openai-codex");
		assert.ok(codex);
		assert.strictEqual(codex.oauthSupported, true);
		assert.strictEqual(codex.oauthName, "OpenAI (ChatGPT Plus/Pro)");
		assert.strictEqual(codex.oauthStored, false);

		const models = (await (await app.request("/api/models")).json()) as Record<string, unknown[]>;
		assert.ok(models.openai.length > 0);
		assert.strictEqual((await stat(join(root, "credentials.json"))).mode & 0o777, 0o600);
		assert.match(await readFile(join(root, "credentials.json"), "utf8"), new RegExp(secret));

		const removed = await app.request("/api/providers/openai/api-key", { method: "DELETE" });
		assert.strictEqual(removed.status, 200);
		const filtered = (await (await app.request("/api/models")).json()) as Record<string, unknown[]>;
		assert.strictEqual(filtered.openai, undefined);
	});

	it("exposes the standard BigModel provider and its models after API-key setup", async () => {
		const app = new Hono();
		registerSDKRoutes(app);

		const initial = (await (await app.request("/api/providers")).json()) as {
			providers: Array<{
				id: string;
				name: string;
				configured: boolean;
				envVariable?: string;
				modelCount: number;
				manageable: boolean;
			}>;
		};
		const bigmodel = initial.providers.find((provider) => provider.id === "bigmodel");
		assert.ok(bigmodel);
		assert.equal(bigmodel.name, "BigModel");
		assert.equal(bigmodel.configured, false);
		assert.equal(bigmodel.envVariable, "BIGMODEL_API_KEY");
		assert.equal(bigmodel.modelCount, 5);
		assert.equal(bigmodel.manageable, true);

		const secret = "test-bigmodel-key-never-return";
		const saved = await app.request("/api/providers/bigmodel/api-key", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: secret }),
		});
		assert.equal(saved.status, 200);
		assert.doesNotMatch(await saved.clone().text(), new RegExp(secret));

		const models = (await (await app.request("/api/models")).json()) as Record<
			string,
			Array<{ id: string; provider: string }>
		>;
		assert.deepEqual(
			models.bigmodel?.map((model) => model.id),
			["glm-5.2", "glm-5", "glm-5.1", "glm-4.7", "glm-4.7-flash"],
		);
		assert.ok(models.bigmodel?.every((model) => model.provider === "bigmodel"));

		const removed = await app.request("/api/providers/bigmodel/api-key", { method: "DELETE" });
		assert.equal(removed.status, 200);
		const filtered = (await (await app.request("/api/models")).json()) as Record<string, unknown[]>;
		assert.equal(filtered.bigmodel, undefined);
	});
});
