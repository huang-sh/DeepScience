import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import { SCIENCE_RESOURCES_ROOT } from "./science-package.ts";
import type { CatalogAccessMode } from "./skill-catalog.ts";

export const RESOURCE_SKILLS_ROOT = resolve(SCIENCE_RESOURCES_ROOT, "skills");
const CACHE_TTL_MS = 30_000;
const IGNORED_DIRECTORIES = new Set([".git", ".venv", "__pycache__", "node_modules"]);

export interface ResourcePackageEntry {
	name: string;
	description: string;
	categoryPath: string[];
	collection: string;
	database: string;
	accessMode: CatalogAccessMode;
	filePath: string;
	rootPath: string;
	content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function categorySegments(value: string): string[] {
	return value
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

function parseDocument(raw: string, filePath: string): { frontmatter: Record<string, unknown>; content: string } {
	const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (!normalized.startsWith("---\n")) throw new Error(`Missing YAML frontmatter: ${filePath}`);
	const end = normalized.indexOf("\n---\n", 4);
	if (end === -1) throw new Error(`Unterminated YAML frontmatter: ${filePath}`);
	const parsed: unknown = parse(normalized.slice(4, end));
	if (!isRecord(parsed)) throw new Error(`Invalid YAML frontmatter: ${filePath}`);
	return { frontmatter: parsed, content: normalized.slice(end + 5).trim() };
}

async function findResourceDocuments(directory: string, result: string[]): Promise<void> {
	let entries: Dirent[];
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (IGNORED_DIRECTORIES.has(entry.name)) continue;
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) await findResourceDocuments(path, result);
		else if (entry.isFile() && entry.name === "RESOURCE.md") result.push(path);
	}
}

export class ResourcePackageCatalog {
	private packages = new Map<string, ResourcePackageEntry>();
	private loadedAt = 0;
	private loading?: Promise<void>;

	private async ensureFresh(): Promise<void> {
		if (this.packages.size > 0 && Date.now() - this.loadedAt < CACHE_TTL_MS) return;
		if (this.loading) return this.loading;
		this.loading = this.reload().finally(() => {
			this.loading = undefined;
		});
		return this.loading;
	}

	async reload(): Promise<void> {
		const documents: string[] = [];
		await findResourceDocuments(RESOURCE_SKILLS_ROOT, documents);
		const packages = new Map<string, ResourcePackageEntry>();
		for (const filePath of documents.sort()) {
			const rootPath = dirname(filePath);
			const relativeParts = relative(RESOURCE_SKILLS_ROOT, rootPath).split(sep).filter(Boolean);
			const collection = relativeParts[0];
			if (!collection || relativeParts.length < 2) {
				throw new Error(`Resource package must be nested below a top-level Resource Skill: ${filePath}`);
			}
			const { frontmatter, content } = parseDocument(await readFile(filePath, "utf8"), filePath);
			const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : "";
			const description = typeof frontmatter.description === "string" ? frontmatter.description.trim() : "";
			const inferredCategory = [collection, ...relativeParts.slice(1, -1)].join("/");
			const categoryPath = categorySegments(
				typeof frontmatter.category === "string" ? frontmatter.category : inferredCategory,
			);
			if (!name || !description || categoryPath[0] !== collection) {
				throw new Error(`Invalid Resource metadata or collection category: ${filePath}`);
			}
			if (packages.has(name)) throw new Error(`Duplicate Resource package name: ${name}`);
			const metadata = isRecord(frontmatter.metadata) ? frontmatter.metadata : {};
			const mode = metadata["access-mode"] ?? frontmatter["access-mode"];
			packages.set(name, {
				name,
				description,
				categoryPath,
				collection,
				database:
					typeof metadata.database === "string"
						? metadata.database.trim()
						: name.startsWith("biomarker-")
							? name.slice("biomarker-".length)
							: name,
				accessMode: mode === "remote" || mode === "hybrid" ? mode : "local",
				filePath,
				rootPath,
				content,
			});
		}
		this.packages = packages;
		this.loadedAt = Date.now();
	}

	async list(collection?: string): Promise<ResourcePackageEntry[]> {
		await this.ensureFresh();
		return [...this.packages.values()]
			.filter((entry) => !collection || entry.collection === collection)
			.sort(
				(left, right) =>
					left.categoryPath.join("/").localeCompare(right.categoryPath.join("/")) ||
					left.name.localeCompare(right.name),
			);
	}

	async find(name: string): Promise<ResourcePackageEntry | undefined> {
		await this.ensureFresh();
		return this.packages.get(name.trim());
	}
}

export const resourcePackageCatalog = new ResourcePackageCatalog();
