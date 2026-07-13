import { readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Context } from "hono";
import { resolveArtifactStream } from "./artifacts.ts";
import { SCIENCE_RESOURCES_ROOT } from "./science-package.ts";

const RESOURCE_ROOT = SCIENCE_RESOURCES_ROOT;
const RESOURCE_TREE_PATH = resolve(RESOURCE_ROOT, "resource_tree.json");
const MAX_RESOURCE_FILE_SIZE = 150 * 1024 * 1024;

export interface ResourceFile {
	path: string;
	workspacePath: string;
	exists: boolean;
	size: number;
}

export interface ResourceEntry {
	id: string;
	skillName: string;
	name: string;
	dbName: string;
	category: string;
	categoryPath: string[];
	content: string[];
	files: ResourceFile[];
	url: string;
	citation: string;
	accessMode: "local" | "remote" | "hybrid";
}

export interface ResourceCatalogPayload {
	resources: ResourceEntry[];
	categories: Array<{ name: string; count: number }>;
	stats: {
		entries: number;
		uniqueDatabases: number;
		referencedFiles: number;
		localFiles: number;
		missingFiles: number;
		totalBytes: number;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => String(item).trim()).filter(Boolean);
}

function resourcePath(reference: string): string | undefined {
	const relativePath = reference.replace(/^resource\//, "");
	const target = resolve(RESOURCE_ROOT, relativePath);
	if (target !== RESOURCE_ROOT && !target.startsWith(`${RESOURCE_ROOT}${sep}`)) return undefined;
	return target;
}

function collectEntries(node: unknown, categoryPath: string[], entries: ResourceEntry[]): void {
	if (Array.isArray(node)) {
		for (const item of node) collectEntries(item, categoryPath, entries);
		return;
	}
	if (!isRecord(node)) return;

	const dbName = typeof node["db-name"] === "string" ? node["db-name"].trim() : "";
	if (dbName) {
		const reference = isRecord(node.reference) ? node.reference : {};
		const name = typeof node["show-name"] === "string" ? node["show-name"].trim() || dbName : dbName;
		const path = categoryPath[0] === "biomarker" ? categoryPath.slice(1) : categoryPath;
		const declaredAccessMode = node["access-mode"];
		const accessMode =
			declaredAccessMode === "remote" || declaredAccessMode === "hybrid" ? declaredAccessMode : "local";
		entries.push({
			id: `${path.join("/")}::${dbName}`,
			skillName: typeof node["skill-name"] === "string" ? node["skill-name"].trim() : "",
			name,
			dbName,
			category: path[0] ?? "Other",
			categoryPath: path,
			content: strings(node.content),
			files: strings(node.paths).map((item) => ({ path: item, workspacePath: "", exists: false, size: 0 })),
			url: typeof reference["db-url"] === "string" ? reference["db-url"].trim() : "",
			citation: typeof reference.citation === "string" ? reference.citation.trim() : "",
			accessMode,
		});
		return;
	}

	for (const [name, child] of Object.entries(node)) collectEntries(child, [...categoryPath, name], entries);
}

export async function loadResourceCatalog(): Promise<ResourceCatalogPayload> {
	const parsed: unknown = JSON.parse(await readFile(RESOURCE_TREE_PATH, "utf8"));
	const resources: ResourceEntry[] = [];
	collectEntries(parsed, [], resources);

	const knownFiles = new Map<string, { exists: boolean; size: number; workspacePath: string }>();
	for (const resource of resources) {
		for (const file of resource.files) {
			const target = resourcePath(file.path);
			if (!target || knownFiles.has(target)) continue;
			const metadata = await stat(target).catch(() => undefined);
			knownFiles.set(target, {
				exists: metadata?.isFile() ?? false,
				size: metadata?.isFile() ? metadata.size : 0,
				workspacePath: relative(process.cwd(), target).split(sep).join("/"),
			});
		}
	}

	for (const resource of resources) {
		resource.files = resource.files.map((file) => {
			const target = resourcePath(file.path);
			const metadata = target ? knownFiles.get(target) : undefined;
			return {
				...file,
				workspacePath: metadata?.workspacePath ?? "",
				exists: metadata?.exists ?? false,
				size: metadata?.size ?? 0,
			};
		});
	}

	const categoryCounts = new Map<string, number>();
	for (const resource of resources) {
		categoryCounts.set(resource.category, (categoryCounts.get(resource.category) ?? 0) + 1);
	}
	const localFiles = [...knownFiles.values()].filter((file) => file.exists);
	return {
		resources,
		categories: [...categoryCounts]
			.map(([name, count]) => ({ name, count }))
			.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
		stats: {
			entries: resources.length,
			uniqueDatabases: new Set(resources.map((resource) => resource.dbName)).size,
			referencedFiles: resources.reduce((total, resource) => total + resource.files.length, 0),
			localFiles: localFiles.length,
			missingFiles: [...knownFiles.values()].filter((file) => !file.exists).length,
			totalBytes: localFiles.reduce((total, file) => total + file.size, 0),
		},
	};
}

export async function serveResourceFile(c: Context): Promise<Response> {
	const requested = (c.req.query("path") ?? "").replace(/^resource\//, "");
	const result = await resolveArtifactStream(requested, RESOURCE_ROOT, MAX_RESOURCE_FILE_SIZE);
	if (!result.ok) return c.json({ error: result.error }, result.status);

	c.header("Content-Type", result.mimeType);
	c.header("Content-Length", String(result.size));
	c.header("X-Content-Type-Options", "nosniff");
	c.header("Content-Disposition", `inline; filename="${result.filename}"`);
	c.header("Cache-Control", "private, no-store");
	c.header("Content-Security-Policy", "default-src 'none'; sandbox");
	return c.body(result.stream);
}
