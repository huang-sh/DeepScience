import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BIGMODEL_BASE_URL, BIGMODEL_MODELS, bigModelProvider } from "../src/providers/bigmodel.ts";

describe("BigModel provider", () => {
	it("uses the standard BigModel API rather than the Coding Plan endpoint", () => {
		const provider = bigModelProvider();
		assert.equal(provider.id, "bigmodel");
		assert.equal(provider.name, "BigModel");
		assert.equal(provider.baseUrl, "https://open.bigmodel.cn/api/paas/v4");
		assert.ok(!provider.baseUrl.includes("/coding/"));
	});

	it("exposes GLM models with the BigModel provider identity and base URL", () => {
		assert.deepEqual(
			BIGMODEL_MODELS.map((model) => model.id),
			[
				"glm-5.2",
				"glm-5",
				"glm-5.1",
				"glm-5v-turbo",
				"glm-4.7",
				"glm-4.7-flash",
				"glm-4.6v",
				"glm-4.6v-flash",
				"glm-4.5v",
			],
		);
		for (const model of BIGMODEL_MODELS) {
			assert.equal(model.provider, "bigmodel");
			assert.equal(model.baseUrl, BIGMODEL_BASE_URL);
			assert.equal(model.api, "openai-completions");
		}
		assert.deepEqual(
			BIGMODEL_MODELS.filter((model) => model.input.includes("image")).map((model) => model.id),
			["glm-5v-turbo", "glm-4.6v", "glm-4.6v-flash", "glm-4.5v"],
		);
	});

	it("uses remote discovery for account availability while retaining trusted capabilities", async () => {
		const provider = bigModelProvider({
			resolveApiKey: async () => "test-key",
			fetch: async () =>
				new Response(JSON.stringify({ data: [{ id: "glm-5.2" }, { id: "glm-4.6v" }, { id: "unknown" }] })),
		});
		await provider.refreshModels?.();
		assert.deepEqual(
			provider.getModels().map((model) => model.id),
			["glm-5.2", "glm-4.6v"],
		);
		assert.deepEqual(provider.getModels()[1]?.input, ["text", "image"]);
	});

	it("keeps the verified catalog when remote discovery fails", async () => {
		const provider = bigModelProvider({
			resolveApiKey: async () => "test-key",
			fetch: async () => new Response("unavailable", { status: 503 }),
		});
		assert.ok(provider.refreshModels);
		await assert.rejects(provider.refreshModels());
		assert.equal(provider.getModels().length, BIGMODEL_MODELS.length);
	});
});
