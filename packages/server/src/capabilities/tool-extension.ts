import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ExtensionFactory, ToolDefinition } from "@earendil-works/pi-coding-agent";

export function createToolExtension(tools: AgentTool[]): ExtensionFactory {
	return (pi) => {
		for (const tool of tools) {
			pi.registerTool({
				name: tool.name,
				label: tool.label,
				description: tool.description,
				parameters: tool.parameters,
				executionMode: tool.executionMode,
				execute: (toolCallId, params, signal, onUpdate) => tool.execute(toolCallId, params, signal, onUpdate),
			} as ToolDefinition);
		}
	};
}
