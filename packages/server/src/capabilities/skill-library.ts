import type { Action } from "@shying/ds-science";
import { evaluate, isToolAllowed, type Ruleset } from "@shying/ds-science";
import { type SkillCatalogEntry, skillCatalog } from "../skill-catalog.ts";
import { createSkillTool } from "../skill-tool.ts";
import { createToolExtension } from "./tool-extension.ts";
import { type DeepScienceCapability, markCapabilityEntryLoaded } from "./types.ts";

export const SKILL_LIBRARY_CAPABILITY_ID = "skill-library";

function evaluateAccess(skill: SkillCatalogEntry, ruleset: Ruleset): Action {
	const nameAction = evaluate("skill", skill.name, ruleset).action;
	const categoryAction = evaluate("skill.category", skill.categoryPath.join("/"), ruleset).action;
	if (nameAction === "deny" || categoryAction === "deny") return "deny";
	if (nameAction === "ask" || categoryAction === "ask") return "ask";
	return "allow";
}

export const skillLibraryCapability: DeepScienceCapability = {
	id: SKILL_LIBRARY_CAPABILITY_ID,
	async create(context) {
		if (!isToolAllowed("skill", context.permission)) return undefined;
		const access = (skill: SkillCatalogEntry): Action => evaluateAccess(skill, context.permission);
		const visibleSkills = (await skillCatalog.list({ limit: 5_000 })).filter((skill) => access(skill) !== "deny");
		const visibleSources = new Set(visibleSkills.map((skill) => skill.source));
		const description = await skillCatalog.getToolDescription((skill) => access(skill) !== "deny");
		const tool = createSkillTool(
			(name) => markCapabilityEntryLoaded(context.getSidecar(), SKILL_LIBRARY_CAPABILITY_ID, name),
			{
				description,
				isVisible: (skill) => access(skill) !== "deny",
				trackUsage: true,
				authorize: (skill) => {
					const action = access(skill);
					if (action === "allow") return { allowed: true };
					return {
						allowed: false,
						reason:
							action === "deny"
								? `Permission denied for skill ${skill.name}.`
								: `Skill ${skill.name} requires explicit approval before it can be loaded.`,
					};
				},
			},
		);
		const prompt = [
			"## Dynamic Skill Discovery",
			"The live DeepScience skill catalog is authoritative; do not assume a skill exists because another prompt mentions it.",
			`This agent can access ${visibleSkills.length} deduplicated ordinary skills from ${visibleSources.size} collections. No ordinary-skill index or full instructions are embedded in this prompt.`,
			"Use the category directory exposed by the skill tool to choose the narrowest relevant category. Browse that category to receive the complete Pi-style metadata list, compare its descriptions, then use action=read with one exact skill name. Do not use keyword search for skill discovery and do not use the general read tool to load SKILL.md files, because skill reads are tracked in session state.",
			"When a user message starts with /<skill-name>, your first action must be a silent skill tool read for that exact name. After loading it, treat the remainder of the message as the task. If the name is unknown, report the tool's suggestions.",
		].join("\n\n");
		return { extension: createToolExtension([tool]), appendSystemPrompt: prompt };
	},
};
