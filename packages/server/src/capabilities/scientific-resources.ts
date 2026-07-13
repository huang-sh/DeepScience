import type { Action } from "@shying/ds-science";
import { evaluate, isToolAllowed, type Ruleset } from "@shying/ds-science";
import { resourceSkillCatalog } from "../resource-skill-catalog.ts";
import { createResourceTool } from "../resource-tool.ts";
import type { SkillCatalogEntry } from "../skill-catalog.ts";
import { createToolExtension } from "./tool-extension.ts";
import { type DeepScienceCapability, getLoadedCapabilityEntries, markCapabilityEntryLoaded } from "./types.ts";

export const SCIENTIFIC_RESOURCES_CAPABILITY_ID = "scientific-resources";

function evaluateAccess(resource: SkillCatalogEntry, ruleset: Ruleset): Action {
	const nameAction = evaluate("resource", resource.name, ruleset).action;
	const categoryAction = evaluate("resource.category", resource.categoryPath.join("/"), ruleset).action;
	if (nameAction === "deny" || categoryAction === "deny") return "deny";
	if (nameAction === "ask" || categoryAction === "ask") return "ask";
	return "allow";
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export const scientificResourcesCapability: DeepScienceCapability = {
	id: SCIENTIFIC_RESOURCES_CAPABILITY_ID,
	async create(context) {
		if (!isToolAllowed("resource", context.permission)) return undefined;
		const access = (resource: SkillCatalogEntry): Action => evaluateAccess(resource, context.permission);
		const visibleResources = (await resourceSkillCatalog.list({ limit: 5_000 })).filter(
			(resource) => access(resource) !== "deny",
		);
		const description = await resourceSkillCatalog.getToolDescription((resource) => access(resource) !== "deny", {
			noun: "resource",
			directoryTag: "resource_category_directory",
		});
		const tool = createResourceTool(
			(name) => markCapabilityEntryLoaded(context.getSidecar(), SCIENTIFIC_RESOURCES_CAPABILITY_ID, name),
			{
				description: `${description} Top-level Resource Skills are peers. Read one first; its nested database categories and exact package metadata are then progressively disclosed by this same tool. Database packages provide task guidance and package-relative materials, not fixed query functions.`,
				initiallyLoaded: getLoadedCapabilityEntries(context.getSidecar(), SCIENTIFIC_RESOURCES_CAPABILITY_ID),
				initiallyExposedNames: visibleResources.map((resource) => resource.name),
				isVisible: (resource) => access(resource) !== "deny",
				authorize: (resource) => {
					const action = access(resource);
					if (action === "allow") return { allowed: true };
					return {
						allowed: false,
						reason:
							action === "deny"
								? `Permission denied for resource ${resource.name}.`
								: `Resource ${resource.name} requires explicit approval before it can be loaded.`,
					};
				},
			},
		);
		const metadata = `<available_skills>\n${visibleResources
			.map(
				(resource) =>
					`  <skill>\n    <name>${escapeXml(resource.name)}</name>\n    <description>${escapeXml(resource.description)}</description>\n    <location>${escapeXml(resource.filePath)}</location>\n  </skill>`,
			)
			.join("\n")}\n</available_skills>`;
		const prompt = [
			"## Dynamic Scientific Resource Discovery",
			"Ordinary skills and scientific resources are separate catalogs with separate loaded state. The following peer top-level Resource Skills are directly exposed with Pi-style metadata. Their full instructions are not loaded yet.",
			metadata,
			'Select directly from the exposed metadata and load the relevant top-level Skill with resource({ action: "read", name: "<exact-name>" }); an initial resource list call is unnecessary. After loading it, browse its nested categories and read exact database package instructions. Never use the ordinary skill tool or general file tools to bypass tracked Resource loading.',
			"A database package is guidance for the Agent, not a fixed query function. After reading its RESOURCE.md, use the exact absolute <resource-root> returned by the resource tool or the injected $DEEPSCIENCE_RESOURCE_ROOT for every package script, reference, or asset. Never infer a repository root from the user Project and never prepend the Project path to a Resource path. Inspect only the materials needed for the user task and decide how to execute with available general tools. Each package's local, remote, or hybrid access mode controls the evidence source.",
			"For a remote package, use a bundled script when it fits the task; otherwise follow the loaded API documentation and construct a bounded query with available tools. Missing local assets or scripts is normal for remote packages. Report network, authentication, licensing, and upstream-service failures explicitly. Keep resource packages read-only, avoid loading large source files into context, and write derived outputs directly to the isolated execution Workspace.",
		].join("\n\n");
		return { extension: createToolExtension([tool]), appendSystemPrompt: prompt };
	},
};
