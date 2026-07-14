import {
	createProvider,
	envApiKeyAuth,
	type Model,
	type OpenAICompletionsCompat,
	type Provider,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { BIGMODEL_MODEL_CATALOG, type BigModelCapability } from "./bigmodel-catalog.ts";

export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const BIGMODEL_COMPAT = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	thinkingFormat: "zai",
	zaiToolStream: true,
} satisfies OpenAICompletionsCompat;

function catalogModel(capability: BigModelCapability): Model<"openai-completions"> {
	return {
		id: capability.id,
		name: capability.name,
		api: "openai-completions",
		provider: "bigmodel",
		baseUrl: BIGMODEL_BASE_URL,
		compat: BIGMODEL_COMPAT,
		reasoning: capability.reasoning,
		input: [...capability.input],
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
		},
		contextWindow: capability.contextWindow,
		maxTokens: capability.maxTokens,
	};
}

export const BIGMODEL_MODELS = BIGMODEL_MODEL_CATALOG.map(catalogModel);

export interface BigModelProviderOptions {
	resolveApiKey?: () => Promise<string | undefined>;
	fetch?: typeof globalThis.fetch;
}

interface RemoteModelList {
	data?: Array<{ id?: unknown }>;
}

async function discoverModels(options: BigModelProviderOptions): Promise<readonly Model<"openai-completions">[]> {
	const apiKey = await options.resolveApiKey?.();
	if (!apiKey) throw new Error("BigModel model discovery requires authentication");
	const fetchImpl = options.fetch ?? globalThis.fetch;
	const response = await fetchImpl(`${BIGMODEL_BASE_URL}/models`, {
		headers: { Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(4_000),
	});
	if (!response.ok) throw new Error(`BigModel model discovery failed with HTTP ${response.status}`);
	const payload = (await response.json()) as RemoteModelList;
	const available = new Set((payload.data ?? []).flatMap((entry) => (typeof entry.id === "string" ? [entry.id] : [])));
	const discovered = BIGMODEL_MODEL_CATALOG.filter((entry) => available.has(entry.id)).map(catalogModel);
	if (discovered.length === 0) throw new Error("BigModel returned no recognized chat models");
	return discovered;
}

/** BigModel's standard pay-as-you-go API; deliberately not the Coding Plan endpoint. */
export function bigModelProvider(options: BigModelProviderOptions = {}): Provider<"openai-completions"> {
	return createProvider({
		id: "bigmodel",
		name: "BigModel",
		baseUrl: BIGMODEL_BASE_URL,
		auth: {
			apiKey: envApiKeyAuth("BigModel API key", ["BIGMODEL_API_KEY", "ZHIPUAI_API_KEY"]),
		},
		models: BIGMODEL_MODELS,
		refreshModels: options.resolveApiKey ? () => discoverModels(options) : undefined,
		api: openAICompletionsApi(),
	});
}
