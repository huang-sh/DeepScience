import {
	createProvider,
	envApiKeyAuth,
	type Model,
	type OpenAICompletionsCompat,
	type Provider,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const BIGMODEL_COMPAT = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	thinkingFormat: "zai",
	zaiToolStream: true,
} satisfies OpenAICompletionsCompat;

function textModel(id: string, name: string, contextWindow: number, maxTokens: number): Model<"openai-completions"> {
	return {
		id,
		name,
		api: "openai-completions",
		provider: "bigmodel",
		baseUrl: BIGMODEL_BASE_URL,
		compat: BIGMODEL_COMPAT,
		reasoning: true,
		input: ["text"],
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
		},
		contextWindow,
		maxTokens,
	};
}

export const BIGMODEL_MODELS = [
	textModel("glm-5.2", "GLM-5.2", 200_000, 131_072),
	textModel("glm-5", "GLM-5", 200_000, 131_072),
	textModel("glm-5.1", "GLM-5.1", 200_000, 131_072),
	textModel("glm-4.7", "GLM-4.7", 204_800, 131_072),
	textModel("glm-4.7-flash", "GLM-4.7-Flash", 200_000, 131_072),
] as const;

/** BigModel's standard pay-as-you-go API; deliberately not the Coding Plan endpoint. */
export function bigModelProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "bigmodel",
		name: "BigModel",
		baseUrl: BIGMODEL_BASE_URL,
		auth: {
			apiKey: envApiKeyAuth("BigModel API key", ["BIGMODEL_API_KEY", "ZHIPUAI_API_KEY"]),
		},
		models: BIGMODEL_MODELS,
		api: openAICompletionsApi(),
	});
}
