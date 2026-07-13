import type { AgentTool } from "@earendil-works/pi-agent-core";
import { type Rule, type Ruleset, wildcardMatch } from "../permission/ruleset.ts";
import { type BasicToolWorkspace, basicTools, createBasicTools } from "./basic.ts";

const ALL_TOOLS: AgentTool[] = [...basicTools];

export function getToolsForAgent(_agentName: string, permission: Ruleset, workspace?: BasicToolWorkspace): AgentTool[] {
	const tools = workspace ? createBasicTools(workspace) : ALL_TOOLS;
	return tools.filter((tool) => {
		// Check permission rules — deny rules block the tool
		const rule = permission.findLast((r: Rule) => wildcardMatch(tool.name, r.permission));
		if (!rule) return true;
		return rule.action !== "deny";
	});
}

export function getAllToolNames(): string[] {
	return ALL_TOOLS.map((t) => t.name);
}

export { basicTools, createBasicTools, type BasicToolWorkspace };
