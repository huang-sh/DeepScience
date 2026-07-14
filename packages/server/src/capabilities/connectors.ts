import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { DeepScienceCapability } from "./types.ts";

const require = createRequire(import.meta.url);
const MCP_ADAPTER_ROOT = dirname(require.resolve("pi-mcp-adapter/package.json"));

export const connectorsCapability: DeepScienceCapability = {
	id: "connectors",
	async create(context) {
		if (!context.workspace) return undefined;
		return {
			extensionPaths: [MCP_ADAPTER_ROOT],
			appendSystemPrompt: `# Connectors

Global and project MCP connectors are available through the single lazy \`mcp\` tool. DeepScience-managed configuration lives in \`~/.deepscience/mcp.json\` and is shared by every Workspace. Adapter-native project overrides in \`.mcp.json\` and \`.pi/mcp.json\` are also discovered, while generated files still belong in the Session execution workspace.

- Use \`mcp({ search: "..." })\` to discover a relevant remote tool; do not guess tool names.
- Search results are relevance matches and may contain several candidates. Inspect their names and descriptions, select the semantically exact tool, and never call the first match automatically.
- Use \`mcp({ describe: "exact_tool_name" })\` when its arguments are unclear.
- Invoke it with \`mcp({ tool: "exact_tool_name", args: "{...}" })\`; \`args\` is a JSON string.
- Connectors are lazy. Do not connect to, enumerate, or call them unless they materially help the user's request.
- Treat a configured connector as available on demand, not as currently connected. Report connection or authentication failures accurately.
- Prefer DeepScience's local Scientific Resources when they fully answer the request; use a connector for external systems or capabilities that are not locally available.`,
		};
	},
};
