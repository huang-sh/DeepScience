export interface BigModelCapability {
	id: string;
	name: string;
	input: readonly ("text" | "image")[];
	reasoning: boolean;
	contextWindow: number;
	maxTokens: number;
}

/**
 * Capability overlay for BigModel chat-completion models.
 *
 * Remote model discovery determines account availability. This catalog supplies
 * the modality and token metadata that OpenAI-compatible model-list responses
 * do not reliably include.
 */
export const BIGMODEL_MODEL_CATALOG = [
	{ id: "glm-5.2", name: "GLM-5.2", input: ["text"], reasoning: true, contextWindow: 200_000, maxTokens: 131_072 },
	{ id: "glm-5", name: "GLM-5", input: ["text"], reasoning: true, contextWindow: 200_000, maxTokens: 131_072 },
	{ id: "glm-5.1", name: "GLM-5.1", input: ["text"], reasoning: true, contextWindow: 200_000, maxTokens: 131_072 },
	{
		id: "glm-5v-turbo",
		name: "GLM-5V-Turbo",
		input: ["text", "image"],
		reasoning: true,
		contextWindow: 200_000,
		maxTokens: 131_072,
	},
	{ id: "glm-4.7", name: "GLM-4.7", input: ["text"], reasoning: true, contextWindow: 204_800, maxTokens: 131_072 },
	{
		id: "glm-4.7-flash",
		name: "GLM-4.7-Flash",
		input: ["text"],
		reasoning: true,
		contextWindow: 200_000,
		maxTokens: 131_072,
	},
	{
		id: "glm-4.6v",
		name: "GLM-4.6V",
		input: ["text", "image"],
		reasoning: true,
		contextWindow: 131_072,
		maxTokens: 16_384,
	},
	{
		id: "glm-4.6v-flash",
		name: "GLM-4.6V-Flash",
		input: ["text", "image"],
		reasoning: true,
		contextWindow: 131_072,
		maxTokens: 16_384,
	},
	{
		id: "glm-4.5v",
		name: "GLM-4.5V",
		input: ["text", "image"],
		reasoning: true,
		contextWindow: 65_536,
		maxTokens: 16_384,
	},
] as const satisfies readonly BigModelCapability[];
