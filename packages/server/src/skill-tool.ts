import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { SkillCatalog, SkillCatalogEntry } from "./skill-catalog.ts";
import { skillCatalog } from "./skill-catalog.ts";
import { recordSkillUsage } from "./skill-lifecycle.ts";

const skillSchema = Type.Object({
	action: Type.Optional(
		Type.Union([Type.Literal("list"), Type.Literal("read")], {
			description: "Browse categories or read the full instructions for one exact skill",
		}),
	),
	category: Type.Optional(
		Type.String({ description: "Hierarchical category path to browse, for example biology/single-cell" }),
	),
	source: Type.Optional(
		Type.Union(
			[
				Type.Literal("deepscience"),
				Type.Literal("tooluniverse"),
				Type.Literal("bioskills"),
				Type.Literal("project"),
				Type.Literal("claude"),
				Type.Literal("user"),
				Type.Literal("learned"),
				Type.Literal("installed"),
				Type.Literal("cache"),
			],
			{ description: "Optional collection filter for category browsing" },
		),
	),
	name: Type.Optional(Type.String({ description: "Exact skill name for the read action" })),
});

function textResult(text: string, details: Record<string, unknown>) {
	return { content: [{ type: "text" as const, text }], details };
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function categorySegments(value: string | undefined): string[] {
	return (value ?? "")
		.split("/")
		.map((segment) =>
			segment
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter(Boolean);
}

export interface SkillToolOptions {
	description?: string;
	authorize?: (
		skill: SkillCatalogEntry,
	) => Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string };
	isVisible?: (skill: SkillCatalogEntry) => boolean;
	trackUsage?: boolean;
	/** Require a leaf-category metadata listing before an exact read. */
	requireMetadataExposure?: boolean;
	/** Include canonical names when a returned child category is already a leaf. */
	includeLeafNamesInDirectory?: boolean;
	/** Names whose metadata was already embedded by the application. */
	initiallyExposedNames?: readonly string[];
}

export interface CatalogToolIdentity {
	name: string;
	label: string;
	noun: string;
	plural: string;
	element: string;
	availableElement: string;
}

export function createCatalogTool(
	catalog: SkillCatalog,
	identity: CatalogToolIdentity,
	onLoaded: (name: string) => void | Promise<void>,
	options?: SkillToolOptions,
): AgentTool<typeof skillSchema> {
	const exposedNames = new Set(options?.initiallyExposedNames ?? []);
	return {
		name: identity.name,
		label: identity.label,
		description:
			options?.description ??
			`Choose a DeepScience category, inspect its complete Pi-style ${identity.noun} metadata, then read exactly one ${identity.noun} on demand.`,
		parameters: skillSchema,
		async execute(_id, params, signal) {
			if (signal?.aborted) throw new Error("Skill operation aborted");
			const action = params.action ?? (params.name ? "read" : "list");
			if (action === "read") {
				const name = params.name?.trim();
				if (!name) return textResult(`The read action requires an exact ${identity.noun} name.`, { error: true });
				const metadata = await catalog.find(name);
				if (!metadata) {
					const suggestions = (await catalog.suggest(name)).filter(
						(candidate) => !options?.requireMetadataExposure || exposedNames.has(candidate.name),
					);
					const suffix = suggestions.length
						? `\n\nDid you mean: ${suggestions.map((candidate) => candidate.name).join(", ")}?`
						: "";
					const recovery = options?.requireMetadataExposure
						? `\n\n${identity.label} names must not be inferred from category labels. Continue browsing with ${identity.name}({ action: "list", category: "<exact-category-path>" }) until complete metadata is returned, then copy one exact <name>.`
						: "";
					return textResult(`Unknown ${identity.noun}: ${name}${suffix}${recovery}`, {
						error: true,
						name,
						suggestions: suggestions.map((candidate) => candidate.name),
						nextAction: `${identity.name}({ action: "list", category: "<exact-category-path>" })`,
					});
				}
				if (options?.requireMetadataExposure && !exposedNames.has(metadata.name)) {
					const category = metadata.categoryPath.join("/");
					return textResult(
						`${identity.label} ${metadata.name} has not been exposed in this session. First call ${identity.name}({ action: "list", category: "${category}" }), then copy its exact <name> from the returned metadata.`,
						{
							error: true,
							code: "METADATA_NOT_EXPOSED",
							name: metadata.name,
							category,
							nextAction: `${identity.name}({ action: "list", category: "${category}" })`,
						},
					);
				}
				if (metadata.disableModelInvocation) {
					return textResult(`${identity.label} ${metadata.name} cannot be invoked by an agent.`, {
						error: true,
						name: metadata.name,
					});
				}
				const authorization = await options?.authorize?.(metadata);
				if (authorization && !authorization.allowed) {
					return textResult(authorization.reason ?? `Permission denied for ${identity.noun} ${metadata.name}.`, {
						error: true,
						name: metadata.name,
						permission: "denied",
					});
				}
				const skill = await catalog.get(metadata.name);
				if (!skill)
					return textResult(`${identity.label} became unavailable: ${metadata.name}`, {
						error: true,
						name: metadata.name,
					});
				await onLoaded(skill.name);
				if (options?.trackUsage !== false) await recordSkillUsage(skill.name, skill.source).catch(() => undefined);
				return textResult(
					`<${identity.element} name="${skill.name}" location="${skill.filePath}" category="${skill.categoryPath.join("/")}"${skill.accessMode ? ` access-mode="${skill.accessMode}"` : ""}>\nReferences are relative to ${skill.filePath.replace(/\/(?:SKILL|RESOURCE)\.md$/, "")}.\n\n${skill.content}\n</${identity.element}>`,
					{
						name: skill.name,
						category: skill.categoryPath.join("/"),
						source: skill.source,
						accessMode: skill.accessMode,
						loaded: true,
					},
				);
			}

			const skills = (
				await catalog.list({
					category: params.category,
					source: params.source,
					limit: 5_000,
				})
			).filter((skill) => !skill.disableModelInvocation && (options?.isVisible?.(skill) ?? true));
			const parent = categorySegments(params.category);
			const children = new Map<string, SkillCatalogEntry[]>();
			for (const skill of skills) {
				const child = skill.categoryPath[parent.length];
				if (!child) continue;
				const entries = children.get(child) ?? [];
				entries.push(skill);
				children.set(child, entries);
			}
			if (children.size > 0) {
				let includedLeafNames = false;
				const lines = [...children]
					.sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
					.map(([child, entries]) => {
						const path = [...parent, child].join("/");
						const isLeaf = entries.every((entry) => entry.categoryPath.length === parent.length + 1);
						if (options?.includeLeafNamesInDirectory && isLeaf) {
							includedLeafNames = true;
							for (const entry of entries) exposedNames.add(entry.name);
						}
						const names =
							options?.includeLeafNamesInDirectory && isLeaf
								? `; exact names: ${entries
										.map((entry) => entry.name)
										.sort()
										.join(", ")}`
								: "";
						return `- ${path} (${entries.length} ${identity.plural}${names})`;
					});
				const category = parent.join("/");
				const nextAction = includedLeafNames
					? `Names marked as exact are canonical ${identity.noun} names and may be read directly with ${identity.name}({ action: "read", name: "<exact-name>" }). For categories without exact names, continue with ${identity.name}({ action: "list", category: "<exact-category-path>" }).`
					: `These are category paths, not ${identity.noun} names. Choose one exact path and call ${identity.name}({ action: "list", category: "<path>" }). Do not call read yet.`;
				return textResult(
					`<category_directory category="${escapeXml(category)}">\n${lines.join("\n")}\n</category_directory>\n<next_action>${escapeXml(nextAction)}</next_action>`,
					{
						count: children.size,
						action,
						kind: "categories",
						category,
						source: params.source ?? "",
						nextAction,
					},
				);
			}
			if (skills.length === 0) {
				return textResult("No matching category or skills.", {
					count: 0,
					action,
					kind: "skills",
					category: parent.join("/"),
					source: params.source ?? "",
				});
			}
			const category = parent.join("/");
			for (const skill of skills) exposedNames.add(skill.name);
			const metadata = skills
				.map((skill) => {
					const aliases = skill.aliases.map((alias) => `<alias>${escapeXml(alias)}</alias>`).join("");
					return [
						`<${identity.element}>`,
						`<name>${escapeXml(skill.name)}</name>`,
						`<description>${escapeXml(skill.description)}</description>`,
						`<category>${escapeXml(skill.categoryPath.join("/"))}</category>`,
						`<source id="${escapeXml(skill.source)}">${escapeXml(skill.sourceLabel)}</source>`,
						skill.accessMode ? `<access-mode>${skill.accessMode}</access-mode>` : "",
						`<location>${escapeXml(skill.filePath)}</location>`,
						`<aliases>${aliases}</aliases>`,
						`<disable-model-invocation>${skill.disableModelInvocation}</disable-model-invocation>`,
						`</${identity.element}>`,
					].join("");
				})
				.join("");
			return textResult(
				`<${identity.availableElement} category="${escapeXml(category)}" count="${skills.length}">${metadata}</${identity.availableElement}>\n<next_action>Compare the metadata, then call ${identity.name}({ action: "read", name: "&lt;exact-name&gt;" }) using one exact &lt;name&gt; shown above.</next_action>`,
				{
					count: skills.length,
					action,
					kind: `${identity.noun}_metadata`,
					category,
					source: params.source ?? "",
				},
			);
		},
	};
}

export function createSkillTool(
	onLoaded: (name: string) => void | Promise<void>,
	options?: SkillToolOptions,
): AgentTool<typeof skillSchema> {
	return createCatalogTool(
		skillCatalog,
		{
			name: "skill",
			label: "Skill",
			noun: "skill",
			plural: "skills",
			element: "skill",
			availableElement: "available_skills",
		},
		onLoaded,
		options,
	);
}
