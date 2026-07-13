import { RESOURCE_SKILLS_ROOT, type ResourcePackageEntry, resourcePackageCatalog } from "./resource-package-catalog.ts";
import { resourceSkillCatalog } from "./resource-skill-catalog.ts";
import { sanitizeSkillContent } from "./skill-catalog.ts";
import { createCatalogTool, type SkillToolOptions } from "./skill-tool.ts";

export interface ResourceToolOptions extends SkillToolOptions {
	initiallyLoaded?: readonly string[];
}

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

function renderPackageMetadata(packages: ResourcePackageEntry[]): string {
	return packages
		.map(
			(resource) =>
				`<resource><name>${escapeXml(resource.name)}</name><description>${escapeXml(resource.description)}</description><category>${escapeXml(resource.categoryPath.join("/"))}</category><database>${escapeXml(resource.database)}</database><access-mode>${resource.accessMode}</access-mode><location>${escapeXml(resource.filePath)}</location></resource>`,
		)
		.join("");
}

/** Resolve portable Resource documentation paths for the current installation. */
export function resolveResourceContentPaths(content: string, rootPath: string): string {
	return content
		.replaceAll("<RESOURCE_ROOT>", rootPath)
		.replace(/(^|[^/])(?:project\/)?packages\/science\/resources\/skills\//gm, `$1${RESOURCE_SKILLS_ROOT}/`);
}

export function createResourceTool(
	onLoaded: (name: string) => void | Promise<void>,
	options?: ResourceToolOptions,
): ReturnType<typeof createCatalogTool> {
	const loadedTopLevel = new Set(options?.initiallyLoaded ?? []);
	const exposedPackages = new Set<string>();
	const topLevelTool = createCatalogTool(
		resourceSkillCatalog,
		{
			name: "resource",
			label: "Resource",
			noun: "resource",
			plural: "resources",
			element: "resource",
			availableElement: "available_resources",
		},
		async (name) => {
			loadedTopLevel.add(name);
			await onLoaded(name);
		},
		{
			...options,
			trackUsage: false,
			requireMetadataExposure: true,
			includeLeafNamesInDirectory: true,
			description: undefined,
		},
	);

	return {
		...topLevelTool,
		description:
			options?.description ??
			"Load one of the three top-level Resource Skills, then progressively discover and read exact database Resource instructions. This tool exposes guidance and package-relative materials; it does not execute a fixed database query.",
		async execute(id, params, signal) {
			if (signal?.aborted) throw new Error("Resource operation aborted");
			const action = params.action ?? (params.name ? "read" : "list");
			if (action === "read") {
				const name = params.name?.trim();
				if (!name) return textResult("The read action requires an exact resource name.", { error: true });
				const resourcePackage = await resourcePackageCatalog.find(name);
				if (!resourcePackage) return topLevelTool.execute(id, params, signal);
				if (!loadedTopLevel.has(resourcePackage.collection)) {
					return textResult(
						`Load the top-level Resource Skill ${resourcePackage.collection} before reading ${resourcePackage.name}.`,
						{
							error: true,
							code: "RESOURCE_SKILL_NOT_LOADED",
							name: resourcePackage.name,
							nextAction: `resource({ action: "list", category: "${resourcePackage.collection}" })`,
						},
					);
				}
				if (!exposedPackages.has(resourcePackage.name)) {
					const category = resourcePackage.categoryPath.join("/");
					return textResult(
						`Resource ${resourcePackage.name} has not been exposed in this session. Browse ${category}, then copy its exact <name>.`,
						{
							error: true,
							code: "METADATA_NOT_EXPOSED",
							name: resourcePackage.name,
							category,
							nextAction: `resource({ action: "list", category: "${category}" })`,
						},
					);
				}
				const router = await resourceSkillCatalog.find(resourcePackage.collection);
				if (!router)
					return textResult(`Top-level Resource Skill unavailable: ${resourcePackage.collection}`, {
						error: true,
					});
				const authorization = await options?.authorize?.(router);
				if (authorization && !authorization.allowed) {
					return textResult(authorization.reason ?? `Permission denied for resource ${resourcePackage.name}.`, {
						error: true,
						name: resourcePackage.name,
						permission: "denied",
					});
				}
				const resolvedContent = resolveResourceContentPaths(resourcePackage.content, resourcePackage.rootPath);
				return textResult(
					`<resource name="${escapeXml(resourcePackage.name)}" location="${escapeXml(resourcePackage.filePath)}" category="${escapeXml(resourcePackage.categoryPath.join("/"))}" access-mode="${resourcePackage.accessMode}">\n<resource-root>${escapeXml(resourcePackage.rootPath)}</resource-root>\nReferences, scripts, and assets are relative to this exact absolute Resource root. For bash, use this root or $DEEPSCIENCE_RESOURCE_ROOT; never prepend the user Project, change to an assumed repository root, or run a repository-relative example verbatim. Inspect only the materials needed for the user task, then choose the appropriate general execution tools.\n\n${sanitizeSkillContent(resolvedContent)}\n</resource>`,
					{
						name: resourcePackage.name,
						category: resourcePackage.categoryPath.join("/"),
						collection: resourcePackage.collection,
						accessMode: resourcePackage.accessMode,
						location: resourcePackage.filePath,
						rootPath: resourcePackage.rootPath,
						loaded: true,
					},
				);
			}

			const parent = categorySegments(params.category);
			const collection = parent[0];
			if (!collection || !loadedTopLevel.has(collection)) return topLevelTool.execute(id, params, signal);
			const router = await resourceSkillCatalog.find(collection);
			if (!router || !(options?.isVisible?.(router) ?? true)) {
				return textResult("No matching Resource category.", { error: true, category: parent.join("/") });
			}
			const packages = (await resourcePackageCatalog.list(collection)).filter((resource) =>
				parent.every((segment, index) => resource.categoryPath[index] === segment),
			);
			if (packages.length === 0) {
				return textResult("No matching Resource category or database packages.", {
					count: 0,
					category: parent.join("/"),
				});
			}
			const children = new Map<string, ResourcePackageEntry[]>();
			for (const resource of packages) {
				const child = resource.categoryPath[parent.length];
				if (!child) continue;
				const entries = children.get(child) ?? [];
				entries.push(resource);
				children.set(child, entries);
			}
			const category = parent.join("/");
			if (children.size > 0) {
				const lines = [...children]
					.sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
					.map(([child, entries]) => {
						const path = [...parent, child].join("/");
						const isLeaf = entries.every((entry) => entry.categoryPath.length === parent.length + 1);
						if (isLeaf) for (const entry of entries) exposedPackages.add(entry.name);
						const names = isLeaf
							? `; exact names: ${entries
									.map((entry) => entry.name)
									.sort()
									.join(", ")}`
							: "";
						return `- ${path} (${entries.length} resources${names})`;
					});
				return textResult(
					`<resource_category_directory category="${escapeXml(category)}">\n${lines.join("\n")}\n</resource_category_directory>\n<next_action>Browse one exact child path. Names explicitly marked as exact may be read directly.</next_action>`,
					{ count: children.size, kind: "categories", category },
				);
			}
			for (const resource of packages) exposedPackages.add(resource.name);
			return textResult(
				`<available_resources category="${escapeXml(category)}" count="${packages.length}">${renderPackageMetadata(packages)}</available_resources>\n<next_action>Compare the metadata, then read selected packages using one exact <name> shown above.</next_action>`,
				{ count: packages.length, kind: "resource_metadata", category },
			);
		},
	};
}
