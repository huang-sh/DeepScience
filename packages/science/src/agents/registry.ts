import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Action, Ruleset } from "../permission/ruleset.ts";
import { fromConfig, merge } from "../permission/ruleset.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));

const STATIC_SKILL_CATALOG_SECTIONS = [
	["### Available Skill Categories:", "## MANDATORY: You Are an Executor"],
	["## Skill Toolkits", "## Critique Sub-Agent"],
	["## Skill Routing Table", "## Error Recovery Patterns"],
	["## Skill Routing Table", "## Compute Decision Matrix"],
	["## Skill Routing Table", "## Domain-Specific Knowledge"],
	["## Database Skills Reference", "## Parallel Review Pattern"],
	["## Writing Skills (load before writing)", "## Multi-Pass Writing Workflow"],
	[
		"- Load relevant DeepScience skills NOW (see Skill Routing Table below):",
		"- Identify if external database queries would help answer the question",
	],
] as const;

function removeStaticSkillCatalogs(prompt: string): string {
	let result = prompt;
	for (const [startMarker, endMarker] of STATIC_SKILL_CATALOG_SECTIONS) {
		const start = result.indexOf(startMarker);
		if (start === -1) continue;
		const end = result.indexOf(endMarker, start + startMarker.length);
		if (end === -1) continue;
		result = `${result.slice(0, start).trimEnd()}\n\n${result.slice(end).trimStart()}`;
	}
	return result;
}

export type AgentMode = "primary" | "subagent" | "all";

export interface AgentConfig {
	name: string;
	description: string;
	color: string;
	mode: AgentMode;
	hidden?: boolean;
	promptFile?: string;
	steps?: number;
	permission: Ruleset;
}

async function loadPrompt(name: string): Promise<string> {
	try {
		return await readFile(join(moduleDir, "prompts", `${name}.md`), "utf-8");
	} catch {
		return "";
	}
}

async function loadSystemPrompt(name: string): Promise<string> {
	try {
		return await readFile(join(moduleDir, "prompts", "system", `${name}.md`), "utf-8");
	} catch {
		return "";
	}
}

const defaultPermission = fromConfig({
	"*": "allow",
	read: { "*": "allow" },
	bash: { "*": "allow" },
	grep: { "*": "allow" },
	glob: { "*": "allow" },
	write: { "*": "allow" },
	edit: { "*": "allow" },
	skill: { "*": "allow" },
	"skill.category": { "*": "allow" },
	resource: "deny",
	"resource.category": "deny",
});

function agentPermission(overrides: Record<string, string | Record<string, string>>): Ruleset {
	return merge(defaultPermission, fromConfig(overrides));
}

function categoryScope(...categories: string[]): Record<string, string> {
	return Object.fromEntries([["*", "deny"], ...categories.map((category) => [`${category}*`, "allow"])]);
}

export async function getAgentConfigs(): Promise<Record<string, AgentConfig>> {
	return {
		research: {
			name: "research",
			description:
				"Scientific research agent — literature review, data analysis, compute, and synthesis using the live DeepScience skill catalog.",
			color: "#06b6d4",
			mode: "primary",
			promptFile: "research",
			permission: agentPermission({
				question: "allow",
				"skill.category": { "*": "allow", "databases*": "deny" },
				resource: "allow",
				"resource.category": { "*": "allow" },
			}),
		},
		biology: {
			name: "biology",
			description:
				"Computational biology agent — bioinformatics analysis, biological database tools, and systematic data-to-answer workflows.",
			color: "#10b981",
			mode: "all",
			promptFile: "biology",
			permission: agentPermission({
				question: "allow",
				resource: "allow",
				"resource.category": { "*": "allow" },
				"skill.category": categoryScope(
					"biology",
					"chemistry",
					"research",
					"visualization",
					"data-engineering",
					"ml-training",
					"writing",
				),
			}),
		},
		physics: {
			name: "physics",
			description:
				"Computational physics agent — simulation, PDE solving, dynamical systems, symbolic regression, data analysis, and scientific computing.",
			color: "#8b5cf6",
			mode: "all",
			promptFile: "physics",
			permission: agentPermission({
				question: "allow",
				resource: "allow",
				"resource.category": { "*": "allow" },
				"skill.category": categoryScope(
					"physics",
					"quantum",
					"research",
					"visualization",
					"coding",
					"data-engineering",
					"ml-training",
					"cloud-compute",
					"writing",
				),
			}),
		},
		ml: {
			name: "ml",
			description:
				"Machine learning agent — trains, evaluates, and analyzes models end-to-end with rigorous evaluation.",
			color: "#6366f1",
			mode: "all",
			promptFile: "ml",
			permission: agentPermission({
				question: "allow",
				resource: "allow",
				"resource.category": { "*": "allow" },
				"skill.category": categoryScope(
					"ml-training",
					"ml-inference",
					"coding",
					"data-engineering",
					"cloud-compute",
					"visualization",
					"research",
					"llm-tools",
					"writing",
				),
			}),
		},
		write: {
			name: "write",
			description:
				"Scientific & technical writing. Produces LaTeX papers, grants, literature reviews with verified citations and figures.",
			color: "#a78bfa",
			mode: "subagent",
			promptFile: "write",
			permission: agentPermission({
				question: "allow",
				resource: "allow",
				"resource.category": { "*": "allow" },
				"skill.category": categoryScope(
					"writing",
					"research",
					"scholar-evaluation",
					"visualization",
					"document-parsing",
				),
			}),
		},
		literature_review: {
			name: "literature-review",
			description:
				"Full PRISMA literature review — systematic search, screening, eligibility, synthesis, verification.",
			color: "#818cf8",
			mode: "subagent",
			promptFile: "literature-review",
			permission: agentPermission({
				"*": "deny",
				bash: "allow",
				read: "allow",
				glob: "allow",
				grep: "allow",
				skill: "allow",
				"skill.category": categoryScope("research", "scholar-evaluation", "writing"),
				resource: "allow",
				"resource.category": { "*": "allow" },
			}),
		},
		critique: {
			name: "critique",
			description:
				"Scientific critique specialist. Finds blocking errors in research artifacts before expensive actions. Read-only.",
			color: "#ef4444",
			mode: "subagent",
			steps: 60,
			promptFile: "critique",
			permission: agentPermission({
				"*": "deny",
				read: "allow",
				glob: "allow",
				grep: "allow",
				skill: "allow",
				"skill.category": { "*": "allow", "databases*": "deny" },
				resource: "allow",
				"resource.category": { "*": "allow" },
			}),
		},
		reviewer: {
			name: "reviewer",
			description:
				"Blind, adversarial reviewer of research outputs. Traces every claim back to evidence. Read-only.",
			color: "#f59e0b",
			mode: "subagent",
			steps: 60,
			promptFile: "reviewer",
			permission: agentPermission({
				"*": "deny",
				read: "allow",
				glob: "allow",
				grep: "allow",
				skill: "allow",
				"skill.category": { "*": "allow", "databases*": "deny" },
				resource: "allow",
				"resource.category": { "*": "allow" },
			}),
		},
	};
}

export async function getAgentConfig(name: string): Promise<AgentConfig | undefined> {
	const configs = await getAgentConfigs();
	return configs[name];
}

export async function listAgents(): Promise<AgentConfig[]> {
	const configs = await getAgentConfigs();
	return Object.values(configs).filter((a) => a.mode !== "subagent" && !a.hidden);
}

export async function buildSystemPrompt(agentName: string, _modelName?: string): Promise<string> {
	const config = await getAgentConfig(agentName);
	if (!config) throw new Error(`Unknown agent: ${agentName}`);

	const systemBase = await loadSystemPrompt("common");
	const workflow = config.promptFile ? await loadPrompt(config.promptFile) : "";

	return [removeStaticSkillCatalogs(systemBase.trim()), removeStaticSkillCatalogs(workflow.trim())]
		.filter(Boolean)
		.join("\n\n---\n\n");
}

export type { Action };
