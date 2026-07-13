import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, delimiter, dirname, extname, join, relative, resolve, sep } from "node:path";
import { loadSkills } from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import { parse } from "yaml";
import { SCIENCE_PACKAGE_ROOT, SCIENCE_SKILLS_ROOT } from "./science-package.ts";

export type SkillSourceId =
	| "deepscience"
	| "tooluniverse"
	| "bioskills"
	| "project"
	| "claude"
	| "user"
	| "learned"
	| "installed"
	| "cache";

export type CatalogAccessMode = "local" | "remote" | "hybrid";

export interface SkillCatalogEntry {
	name: string;
	description: string;
	category: string;
	categoryPath: string[];
	source: SkillSourceId;
	sourceLabel: string;
	filePath: string;
	disableModelInvocation: boolean;
	aliases: string[];
	accessMode?: CatalogAccessMode;
	remoteContentUrl?: string;
}

export interface SkillCatalogDiagnostic {
	type: "warning";
	code: string;
	message: string;
	path: string;
	source: SkillSourceId;
}

export interface SkillSourceSummary {
	id: SkillSourceId;
	label: string;
	count: number;
}

export interface SkillCatalogStats {
	total: number;
	duplicates: number;
	sources: SkillSourceSummary[];
	categories: Array<{ name: string; count: number }>;
	categoryPaths: Array<{ path: string; count: number }>;
	lastLoadedAt: number;
	hotReload: boolean;
}

export interface SkillSourceConfig {
	path: string;
	id: SkillSourceId;
	label: string;
	priority: number;
	defaultCategory?: string;
}

interface IndexedSkill {
	entry: SkillCatalogEntry;
	contentHash: string;
	quality: number;
	priority: number;
}

interface ParsedSkillDocument {
	frontmatter: Record<string, unknown>;
	body: string;
	parseWarning?: string;
}

interface SkillManifestEntry {
	name: string;
	category: string;
	categoryPath?: string[];
	source: SkillSourceId;
	sourceLabel?: string;
	path: string;
	aliases?: string[];
}

interface RemoteSkillEntry {
	name: string;
	description: string;
	category?: string;
	contentUrl?: string;
	aliases?: string[];
}

interface SkillCategoryNode {
	name: string;
	path: string;
	count: number;
	children: Map<string, SkillCategoryNode>;
}

const CACHE_TTL_MS = 30_000;
const DEFAULT_WATCH_INTERVAL_MS = 10_000;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_LIST_LIMIT = 5_000;
const IGNORED_DIRECTORIES = new Set([".git", ".venv", "__pycache__", "node_modules"]);
const COLLAPSED_LIBRARY_DIRECTORIES = new Set(["core", "curated", "imported"]);
const DEEPSCIENCE_SKILLS_ROOT = SCIENCE_SKILLS_ROOT;
const SOURCE_LABELS: Record<SkillSourceId, string> = {
	deepscience: "DeepScience",
	tooluniverse: "ToolUniverse",
	bioskills: "bioSkills",
	project: "Project",
	claude: "Claude-compatible",
	user: "User",
	learned: "Learned",
	installed: "Installed",
	cache: "Remote cache",
};
const SOURCE_ORDER: SkillSourceId[] = [
	"project",
	"user",
	"learned",
	"installed",
	"claude",
	"deepscience",
	"tooluniverse",
	"bioskills",
	"cache",
];
const SKILL_SOURCE_IDS = new Set<SkillSourceId>(SOURCE_ORDER);
const PERSISTENCE_DIRECTIVE_RE = /\b(?:must|should|always)\s+(?:always\s+)?(?:run|load|invoke|use)\s+this\s+skill\b/gi;

function normalizeToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

function deepscienceDataRoot(): string {
	return resolve(process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience"));
}

function sanitizeDescription(value: string): string {
	return value
		.replace(/[\r\n\t]+/g, " ")
		.replace(/[<>]/g, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

export function sanitizeSkillContent(value: string): string {
	return value.replace(PERSISTENCE_DIRECTIVE_RE, "follow this skill only when explicitly selected");
}

export function isSkillSourceId(value: string | undefined): value is SkillSourceId {
	return Boolean(value && SKILL_SOURCE_IDS.has(value as SkillSourceId));
}

function ancestorDirectories(start: string): string[] {
	const result: string[] = [];
	let current = resolve(start);
	while (true) {
		result.push(current);
		const parent = dirname(current);
		if (parent === current) return result.reverse();
		current = parent;
	}
}

function levenshtein(left: string, right: string): number {
	const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
		let diagonal = previous[0];
		previous[0] = leftIndex;
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
			const above = previous[rightIndex];
			previous[rightIndex] = Math.min(
				previous[rightIndex] + 1,
				previous[rightIndex - 1] + 1,
				diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
			);
			diagonal = above;
		}
	}
	return previous[right.length];
}

function parseLooseFrontmatter(value: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = value.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index].match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
		if (!match) continue;
		const key = match[1];
		let field = match[2].trim();
		if (field === "|" || field === ">") {
			const folded = field === ">";
			const values: string[] = [];
			while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) values.push(lines[++index].trim());
			field = values.join(folded ? " " : "\n");
		}
		if ((field.startsWith('"') && field.endsWith('"')) || (field.startsWith("'") && field.endsWith("'"))) {
			field = field.slice(1, -1);
		}
		result[key] = field === "true" ? true : field === "false" ? false : field;
	}
	return result;
}

function parseSkillDocument(raw: string): ParsedSkillDocument {
	const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (!normalized.startsWith("---\n")) return { frontmatter: {}, body: normalized.trim() };
	const end = normalized.indexOf("\n---", 4);
	if (end === -1) return { frontmatter: {}, body: normalized.trim() };
	const frontmatterText = normalized.slice(4, end);
	try {
		const parsed = parse(frontmatterText);
		return {
			frontmatter:
				parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {},
			body: normalized.slice(end + 4).trim(),
		};
	} catch (error) {
		return {
			frontmatter: parseLooseFrontmatter(frontmatterText),
			body: normalized.slice(end + 4).trim(),
			parseWarning: error instanceof Error ? error.message : String(error),
		};
	}
}

function categoryPathFromPath(filePath: string, source: SkillSourceConfig): string[] {
	const parts = relative(source.path, filePath).split(sep).filter(Boolean);
	const directories = basename(filePath) === "SKILL.md" ? parts.slice(0, -2) : parts.slice(0, -1);
	while (directories.length > 0 && COLLAPSED_LIBRARY_DIRECTORIES.has(directories[0].toLowerCase())) {
		directories.shift();
	}
	const normalized = directories.map(normalizeToken).filter(Boolean);
	if (normalized.length > 0) return normalized;
	return [source.defaultCategory ?? "general"];
}

function normalizeCategoryPath(value: string | string[]): string[] {
	const parts = Array.isArray(value) ? value : value.split("/");
	const normalized = parts.map(normalizeToken).filter(Boolean);
	return normalized.length > 0 ? normalized : ["general"];
}

function catalogAccessMode(frontmatter: Record<string, unknown>): CatalogAccessMode | undefined {
	const metadata =
		typeof frontmatter.metadata === "object" && frontmatter.metadata !== null && !Array.isArray(frontmatter.metadata)
			? (frontmatter.metadata as Record<string, unknown>)
			: {};
	const value = metadata["access-mode"] ?? frontmatter["access-mode"];
	return value === "local" || value === "remote" || value === "hybrid" ? value : undefined;
}

function skillQuality(description: string, body: string): number {
	let score = Math.min(description.trim().length, 320) / 32;
	score += Math.min(body.length, 12_000) / 1_200;
	if (/^#{1,3}\s+/m.test(body)) score += 2;
	if (/\b(workflow|procedure|步骤|流程)\b/i.test(body)) score += 2;
	if (/```/.test(body)) score += 1;
	if (/\b(TODO|placeholder|replace this)\b/i.test(body)) score -= 8;
	return score;
}

function compareCandidates(left: IndexedSkill, right: IndexedSkill): number {
	return (
		right.priority - left.priority ||
		right.quality - left.quality ||
		right.entry.description.length - left.entry.description.length ||
		right.entry.source.localeCompare(left.entry.source) ||
		left.entry.filePath.localeCompare(right.entry.filePath)
	);
}

export class SkillCatalog {
	private skills = new Map<string, IndexedSkill>();
	private aliases = new Map<string, string>();
	private diagnostics: SkillCatalogDiagnostic[] = [];
	private duplicateCount = 0;
	private loadedAt = 0;
	private loading?: Promise<void>;
	private readonly configuredSources?: SkillSourceConfig[];
	private manifest = new Map<string, SkillManifestEntry>();
	private watchTimer?: NodeJS.Timeout;
	private watchedFingerprint = "";
	private checkingChanges = false;

	constructor(sources?: SkillSourceConfig[]) {
		this.configuredSources = sources;
	}

	private sources(): SkillSourceConfig[] {
		if (this.configuredSources) return this.configuredSources;
		const dataRoot = deepscienceDataRoot();
		const sources: SkillSourceConfig[] = [
			{
				path: DEEPSCIENCE_SKILLS_ROOT,
				id: "deepscience",
				label: "DeepScience",
				priority: 50,
			},
			{ path: resolve(homedir(), ".claude", "skills"), id: "claude", label: "Claude-compatible", priority: 65 },
			{ path: resolve(homedir(), ".pi", "agent", "skills"), id: "user", label: "User", priority: 85 },
			{ path: resolve(dataRoot, "user-skills"), id: "user", label: "User", priority: 90 },
			{ path: resolve(dataRoot, "learned-skills"), id: "learned", label: "Learned", priority: 88 },
			{
				path: resolve(dataRoot, "installed-skills"),
				id: "installed",
				label: "Installed",
				priority: 82,
			},
			{ path: resolve(dataRoot, "skill-cache"), id: "cache", label: "Remote cache", priority: 25 },
		];
		for (const [index, directory] of ancestorDirectories(process.cwd()).entries()) {
			const priority = 70 + index;
			sources.push(
				{ path: resolve(directory, ".deepscience", "skill"), id: "project", label: "Project", priority },
				{ path: resolve(directory, ".deepscience", "skills"), id: "project", label: "Project", priority },
				{ path: resolve(directory, ".pi", "skills"), id: "project", label: "Project", priority },
				{
					path: resolve(directory, ".claude", "skills"),
					id: "claude",
					label: "Claude-compatible",
					priority: priority - 5,
				},
			);
		}
		for (const [index, path] of (process.env.DEEPSCIENCE_SKILL_PATHS ?? "")
			.split(delimiter)
			.filter(Boolean)
			.entries()) {
			sources.push({ path: resolve(path), id: "project", label: "Configured", priority: 95 + index });
		}
		const unique = new Map<string, SkillSourceConfig>();
		for (const source of sources) unique.set(`${source.id}:${source.path}`, source);
		return [...unique.values()];
	}

	invalidate(): void {
		this.loadedAt = 0;
	}

	startWatching(intervalMs = DEFAULT_WATCH_INTERVAL_MS): void {
		if (this.watchTimer) return;
		this.watchTimer = setInterval(() => void this.refreshWhenChanged(), Math.max(1_000, intervalMs));
		this.watchTimer.unref();
	}

	stopWatching(): void {
		if (this.watchTimer) clearInterval(this.watchTimer);
		this.watchTimer = undefined;
	}

	private async refreshWhenChanged(): Promise<void> {
		if (this.checkingChanges || this.loading) return;
		this.checkingChanges = true;
		try {
			const fingerprint = await this.computeFingerprint();
			if (this.watchedFingerprint && fingerprint !== this.watchedFingerprint) await this.reload();
			else this.watchedFingerprint = fingerprint;
		} finally {
			this.checkingChanges = false;
		}
	}

	private async computeFingerprint(): Promise<string> {
		const values: string[] = [];
		const visit = async (directory: string): Promise<void> => {
			let entries: Dirent[];
			try {
				entries = await readdir(directory, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				if (IGNORED_DIRECTORIES.has(entry.name)) continue;
				const path = resolve(directory, entry.name);
				if (entry.isDirectory()) await visit(path);
				else if (entry.isFile() && (entry.name === "SKILL.md" || entry.name === "catalog.json")) {
					const metadata = await stat(path).catch(() => undefined);
					if (metadata) values.push(`${path}:${metadata.size}:${metadata.mtimeMs}`);
				}
			}
		};
		await Promise.all(this.sources().map((source) => visit(source.path)));
		return createHash("sha256").update(values.sort().join("\n")).digest("hex");
	}

	private async ensureFresh(): Promise<void> {
		if (Date.now() - this.loadedAt < CACHE_TTL_MS && this.skills.size > 0) return;
		if (this.loading) return this.loading;
		this.loading = this.reload().finally(() => {
			this.loading = undefined;
		});
		return this.loading;
	}

	async reload(): Promise<void> {
		this.manifest = await this.loadManifest();
		const results = await Promise.all(this.sources().map((source) => this.scanSource(source)));
		const remote = await this.scanRemoteIndex();
		const candidates = [...results.flatMap((result) => result.skills), ...remote.skills].sort(compareCandidates);
		const nextDiagnostics = [...results.flatMap((result) => result.diagnostics), ...remote.diagnostics];
		const nextSkills = new Map<string, IndexedSkill>();
		const nextHashes = new Map<string, IndexedSkill>();
		const nextAliases = new Map<string, string>();
		let duplicateCount = 0;

		for (const candidate of candidates) {
			const normalizedName = normalizeToken(candidate.entry.name);
			const sameName = nextSkills.get(normalizedName);
			if (sameName) {
				duplicateCount++;
				nextDiagnostics.push({
					type: "warning",
					code: "duplicate_name",
					message: `Duplicate skill ${candidate.entry.name} omitted; using ${sameName.entry.filePath}`,
					path: candidate.entry.filePath,
					source: candidate.entry.source,
				});
				continue;
			}

			const sameContent = nextHashes.get(candidate.contentHash);
			if (sameContent) {
				duplicateCount++;
				if (candidate.entry.name !== sameContent.entry.name) {
					sameContent.entry.aliases.push(candidate.entry.name);
					sameContent.entry.aliases.sort();
					nextAliases.set(normalizedName, normalizeToken(sameContent.entry.name));
				}
				nextDiagnostics.push({
					type: "warning",
					code: "duplicate_content",
					message: `Equivalent skill content omitted; using ${sameContent.entry.name}`,
					path: candidate.entry.filePath,
					source: candidate.entry.source,
				});
				continue;
			}

			nextSkills.set(normalizedName, candidate);
			nextHashes.set(candidate.contentHash, candidate);
			for (const alias of candidate.entry.aliases) nextAliases.set(normalizeToken(alias), normalizedName);
		}

		this.skills = nextSkills;
		this.aliases = nextAliases;
		this.diagnostics = nextDiagnostics;
		this.duplicateCount = duplicateCount;
		this.loadedAt = Date.now();
		this.watchedFingerprint = await this.computeFingerprint();
	}

	private async scanRemoteIndex(): Promise<{
		skills: IndexedSkill[];
		diagnostics: SkillCatalogDiagnostic[];
	}> {
		const url = process.env.DEEPSCIENCE_SKILL_INDEX_URL;
		if (!url) return { skills: [], diagnostics: [] };
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = (await response.json()) as { skills?: RemoteSkillEntry[] };
			const skills = (payload.skills ?? []).flatMap((remote): IndexedSkill[] => {
				const name = normalizeToken(remote.name);
				const description = sanitizeDescription(remote.description ?? "");
				if (!name || !description || !remote.contentUrl) return [];
				try {
					const contentUrl = new URL(remote.contentUrl, url);
					if (contentUrl.protocol !== "https:" && contentUrl.protocol !== "http:") return [];
					const categoryPath = normalizeCategoryPath(remote.category ?? "general");
					return [
						{
							entry: {
								name,
								description,
								category: categoryPath[0],
								categoryPath,
								source: "cache",
								sourceLabel: SOURCE_LABELS.cache,
								filePath: resolve(deepscienceDataRoot(), "skill-cache", name, "SKILL.md"),
								disableModelInvocation: false,
								aliases: (remote.aliases ?? []).map(normalizeToken).filter(Boolean),
								remoteContentUrl: contentUrl.toString(),
							},
							contentHash: `remote:${name}`,
							quality: skillQuality(description, ""),
							priority: 20,
						},
					];
				} catch {
					return [];
				}
			});
			return { skills, diagnostics: [] };
		} catch (error) {
			return {
				skills: [],
				diagnostics: [
					{
						type: "warning",
						code: "remote_index_failed",
						message: error instanceof Error ? error.message : String(error),
						path: url,
						source: "cache",
					},
				],
			};
		}
	}

	private async loadManifest(): Promise<Map<string, SkillManifestEntry>> {
		if (this.configuredSources) return new Map();
		try {
			const value = JSON.parse(await readFile(resolve(DEEPSCIENCE_SKILLS_ROOT, "catalog.json"), "utf8")) as {
				skills?: SkillManifestEntry[];
			};
			return new Map((value.skills ?? []).map((entry) => [entry.path, entry]));
		} catch {
			return new Map();
		}
	}

	private async scanSource(
		source: SkillSourceConfig,
	): Promise<{ skills: IndexedSkill[]; diagnostics: SkillCatalogDiagnostic[] }> {
		const skills: IndexedSkill[] = [];
		const diagnostics: SkillCatalogDiagnostic[] = [];
		const visited = new Set<string>();

		const scanDirectory = async (directory: string, includeRootMarkdown: boolean): Promise<void> => {
			let canonical: string;
			try {
				canonical = await realpath(directory);
			} catch (error) {
				if (directory === source.path && (error as NodeJS.ErrnoException).code === "ENOENT") return;
				diagnostics.push({
					type: "warning",
					code: "list_failed",
					message: error instanceof Error ? error.message : String(error),
					path: directory,
					source: source.id,
				});
				return;
			}
			if (visited.has(canonical)) return;
			visited.add(canonical);

			let entries: Dirent[];
			try {
				entries = await readdir(directory, { withFileTypes: true });
			} catch (error) {
				diagnostics.push({
					type: "warning",
					code: "list_failed",
					message: error instanceof Error ? error.message : String(error),
					path: directory,
					source: source.id,
				});
				return;
			}

			const skillFile = entries.find((entry) => entry.isFile() && entry.name === "SKILL.md");
			if (skillFile) {
				const indexed = await this.indexSkill(resolve(directory, skillFile.name), source, diagnostics);
				if (indexed) skills.push(indexed);
				return;
			}

			for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
				if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name)) continue;
				const path = resolve(directory, entry.name);
				if (entry.isDirectory()) {
					await scanDirectory(path, false);
					continue;
				}
				if (entry.isSymbolicLink()) {
					try {
						if ((await stat(path)).isDirectory()) await scanDirectory(path, false);
					} catch {
						/* broken links are ignored */
					}
					continue;
				}
				if (!includeRootMarkdown || !entry.isFile() || extname(entry.name).toLowerCase() !== ".md") continue;
				const indexed = await this.indexSkill(path, source, diagnostics);
				if (indexed) skills.push(indexed);
			}
		};

		await scanDirectory(source.path, true);
		return { skills, diagnostics };
	}

	private async indexSkill(
		filePath: string,
		source: SkillSourceConfig,
		diagnostics: SkillCatalogDiagnostic[],
	): Promise<IndexedSkill | undefined> {
		let raw: string;
		try {
			raw = await readFile(filePath, "utf8");
		} catch (error) {
			diagnostics.push({
				type: "warning",
				code: "read_failed",
				message: error instanceof Error ? error.message : String(error),
				path: filePath,
				source: source.id,
			});
			return undefined;
		}

		const parsed = parseSkillDocument(raw);
		if (parsed.parseWarning) {
			diagnostics.push({
				type: "warning",
				code: "parse_failed",
				message: `Strict YAML parse failed; indexed with compatible metadata parser: ${parsed.parseWarning}`,
				path: filePath,
				source: source.id,
			});
		}

		const fallbackName =
			basename(filePath) === "SKILL.md" ? basename(dirname(filePath)) : basename(filePath, extname(filePath));
		const name = typeof parsed.frontmatter.name === "string" ? parsed.frontmatter.name.trim() : fallbackName;
		const description =
			typeof parsed.frontmatter.description === "string" ? sanitizeDescription(parsed.frontmatter.description) : "";
		if (!description) {
			diagnostics.push({
				type: "warning",
				code: "invalid_metadata",
				message: "description is required",
				path: filePath,
				source: source.id,
			});
			return undefined;
		}

		if (name.length > MAX_NAME_LENGTH || !/^[a-z0-9-]+$/.test(name)) {
			diagnostics.push({
				type: "warning",
				code: "invalid_metadata",
				message: `Skill name must be lowercase kebab-case and at most ${MAX_NAME_LENGTH} characters`,
				path: filePath,
				source: source.id,
			});
			return undefined;
		}
		if (description.length > MAX_DESCRIPTION_LENGTH) {
			diagnostics.push({
				type: "warning",
				code: "invalid_metadata",
				message: `description exceeds ${MAX_DESCRIPTION_LENGTH} characters`,
				path: filePath,
				source: source.id,
			});
		}
		const indexedDescription = description.slice(0, MAX_DESCRIPTION_LENGTH);

		const categoryValue = typeof parsed.frontmatter.category === "string" ? parsed.frontmatter.category : "";
		const manifestPath = relative(DEEPSCIENCE_SKILLS_ROOT, filePath).split(sep).join("/");
		const manifest = this.manifest.get(manifestPath);
		const entrySource = manifest?.source ?? source.id;
		const discoveredCategoryPath = categoryValue
			? normalizeCategoryPath(categoryValue)
			: categoryPathFromPath(filePath, source);
		const categoryPath = manifest?.categoryPath?.length
			? normalizeCategoryPath(manifest.categoryPath)
			: manifest?.category
				? normalizeCategoryPath(manifest.category)
				: discoveredCategoryPath;
		return {
			entry: {
				name,
				description: indexedDescription,
				category: categoryPath[0],
				categoryPath,
				source: entrySource,
				sourceLabel: manifest?.sourceLabel ?? SOURCE_LABELS[entrySource],
				filePath,
				disableModelInvocation: parsed.frontmatter["disable-model-invocation"] === true,
				aliases: manifest?.aliases?.slice().sort() ?? [],
				accessMode: catalogAccessMode(parsed.frontmatter),
			},
			contentHash: createHash("sha256").update(parsed.body).digest("hex"),
			quality: skillQuality(indexedDescription, parsed.body) + source.priority / 1_000,
			priority: source.priority,
		};
	}

	async list(options?: {
		query?: string;
		category?: string;
		source?: SkillSourceId;
		limit?: number;
	}): Promise<SkillCatalogEntry[]> {
		await this.ensureFresh();
		const query = options?.query?.trim().toLowerCase() ?? "";
		const categoryPath = options?.category ? normalizeCategoryPath(options.category) : [];
		const limit = Math.max(1, Math.min(options?.limit ?? 500, MAX_LIST_LIMIT));
		return [...this.skills.values()]
			.map((item) => item.entry)
			.filter(
				(entry) =>
					categoryPath.length === 0 ||
					categoryPath.every((segment, index) => entry.categoryPath[index] === segment),
			)
			.filter((entry) => !options?.source || entry.source === options.source)
			.filter(
				(entry) =>
					!query ||
					entry.name.toLowerCase().includes(query) ||
					entry.aliases.some((alias) => alias.toLowerCase().includes(query)) ||
					entry.description.toLowerCase().includes(query) ||
					entry.categoryPath.some((segment) => segment.includes(query)) ||
					entry.sourceLabel.toLowerCase().includes(query),
			)
			.sort(
				(left, right) =>
					left.categoryPath.join("/").localeCompare(right.categoryPath.join("/")) ||
					left.name.localeCompare(right.name),
			)
			.slice(0, limit);
	}

	async get(name: string): Promise<(SkillCatalogEntry & { content: string }) | undefined> {
		await this.ensureFresh();
		const normalizedName = normalizeToken(name);
		const canonicalName = this.aliases.get(normalizedName) ?? normalizedName;
		const item = this.skills.get(canonicalName);
		if (!item) return undefined;
		if (item.entry.remoteContentUrl) await this.cacheRemoteSkill(item.entry);
		const env = new NodeExecutionEnv({ cwd: SCIENCE_PACKAGE_ROOT });
		const result = await loadSkills(env, dirname(item.entry.filePath));
		const skill = result.skills.find((candidate) => candidate.filePath === item.entry.filePath) ?? result.skills[0];
		if (skill) return { ...item.entry, content: sanitizeSkillContent(skill.content) };
		const parsed = parseSkillDocument(await readFile(item.entry.filePath, "utf8"));
		return { ...item.entry, content: sanitizeSkillContent(parsed.body) };
	}

	async find(name: string): Promise<SkillCatalogEntry | undefined> {
		await this.ensureFresh();
		const normalizedName = normalizeToken(name);
		const canonicalName = this.aliases.get(normalizedName) ?? normalizedName;
		return this.skills.get(canonicalName)?.entry;
	}

	private async cacheRemoteSkill(entry: SkillCatalogEntry): Promise<void> {
		try {
			await stat(entry.filePath);
			return;
		} catch {
			/* fetch the missing cache entry */
		}
		if (!entry.remoteContentUrl) return;
		const response = await fetch(entry.remoteContentUrl, { signal: AbortSignal.timeout(15_000) });
		if (!response.ok) throw new Error(`Unable to fetch skill ${entry.name}: HTTP ${response.status}`);
		const body = sanitizeSkillContent(await response.text());
		if (Buffer.byteLength(body, "utf8") > 2 * 1024 * 1024) throw new Error(`Skill ${entry.name} exceeds 2 MiB`);
		const parsed = parseSkillDocument(body);
		const content = parsed.body || body;
		await mkdir(dirname(entry.filePath), { recursive: true });
		const temporary = `${entry.filePath}.${process.pid}.tmp`;
		const document = `---\nname: ${entry.name}\ndescription: ${JSON.stringify(entry.description)}\ncategory: ${entry.categoryPath.join("/")}\n---\n\n${content}\n`;
		await writeFile(temporary, document, { encoding: "utf8", mode: 0o600 });
		await rename(temporary, entry.filePath);
	}

	async suggest(name: string, limit = 5): Promise<SkillCatalogEntry[]> {
		await this.ensureFresh();
		const normalized = normalizeToken(name);
		return [...this.skills.values()]
			.map((item) => ({
				entry: item.entry,
				distance: levenshtein(normalized, normalizeToken(item.entry.name)),
			}))
			.filter((candidate) => candidate.distance <= Math.max(3, Math.floor(normalized.length * 0.45)))
			.sort((left, right) => left.distance - right.distance || left.entry.name.localeCompare(right.entry.name))
			.slice(0, Math.max(1, Math.min(limit, 10)))
			.map((candidate) => candidate.entry);
	}

	async getToolDescription(
		isVisible?: (skill: SkillCatalogEntry) => boolean,
		options?: { noun?: string; directoryTag?: string },
	): Promise<string> {
		const skills = (await this.list({ limit: MAX_LIST_LIMIT })).filter(
			(skill) => !skill.disableModelInvocation && (isVisible?.(skill) ?? true),
		);
		const roots = new Map<string, SkillCategoryNode>();
		for (const skill of skills) {
			let children = roots;
			for (let index = 0; index < skill.categoryPath.length; index++) {
				const name = skill.categoryPath[index];
				const path = skill.categoryPath.slice(0, index + 1).join("/");
				let node = children.get(name);
				if (!node) {
					node = { name, path, count: 0, children: new Map() };
					children.set(name, node);
				}
				node.count++;
				children = node.children;
			}
		}
		const renderNodes = (nodes: Map<string, SkillCategoryNode>): string =>
			[...nodes.values()]
				.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
				.map((node) => {
					const attributes = `name="${node.name}" path="${node.path}" count="${node.count}"`;
					return node.children.size > 0
						? `<category ${attributes}>${renderNodes(node.children)}</category>`
						: `<category ${attributes} />`;
				})
				.join("");
		const noun = options?.noun ?? "skill";
		const directoryTag = options?.directoryTag ?? "skill_category_directory";
		return [
			`Discover and load ${skills.length} DeepScience ${noun}s on demand.`,
			`<${directoryTag}>${renderNodes(roots)}</${directoryTag}>`,
			`Choose a category path from this directory. Browsing a parent reveals its children; browsing a leaf returns the complete Pi-style metadata for every ${noun} in that category. Compare those descriptions and locations, then read exactly one selected ${noun}.`,
		]
			.filter(Boolean)
			.join(" ");
	}

	async getStats(): Promise<SkillCatalogStats> {
		await this.ensureFresh();
		const counts = new Map<SkillSourceId, number>();
		for (const item of this.skills.values()) counts.set(item.entry.source, (counts.get(item.entry.source) ?? 0) + 1);
		const sources = SOURCE_ORDER.map((source) => ({
			id: source,
			label: SOURCE_LABELS[source],
			count: counts.get(source) ?? 0,
		})).filter((source) => source.count > 0);
		const categoryCounts = new Map<string, number>();
		const categoryPathCounts = new Map<string, number>();
		for (const item of this.skills.values()) {
			categoryCounts.set(item.entry.category, (categoryCounts.get(item.entry.category) ?? 0) + 1);
			const path = item.entry.categoryPath.join("/");
			categoryPathCounts.set(path, (categoryPathCounts.get(path) ?? 0) + 1);
		}
		const categories = [...categoryCounts]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => a.name.localeCompare(b.name));
		const categoryPaths = [...categoryPathCounts]
			.map(([path, count]) => ({ path, count }))
			.sort((a, b) => a.path.localeCompare(b.path));
		return {
			total: this.skills.size,
			duplicates: this.duplicateCount,
			sources,
			categories,
			categoryPaths,
			lastLoadedAt: this.loadedAt,
			hotReload: Boolean(this.watchTimer),
		};
	}

	async getDiagnostics(): Promise<SkillCatalogDiagnostic[]> {
		await this.ensureFresh();
		return this.diagnostics.slice();
	}
}

export const skillCatalog = new SkillCatalog();
