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
			["glm-5.2", "glm-5", "glm-5.1", "glm-4.7", "glm-4.7-flash"],
		);
		for (const model of BIGMODEL_MODELS) {
			assert.equal(model.provider, "bigmodel");
			assert.equal(model.baseUrl, BIGMODEL_BASE_URL);
			assert.equal(model.api, "openai-completions");
		}
	});
});
