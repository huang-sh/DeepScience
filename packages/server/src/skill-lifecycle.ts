import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { type SkillSourceId, sanitizeSkillContent } from "./skill-catalog.ts";

const execFileAsync = promisify(execFile);
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_BYTES = 2 * 1024 * 1024;
const MAX_INSTALL_FILES = 10_000;
export type ManagedSkillKind = "user" | "learned";

export interface ManagedSkillInput {
	name: string;
	description: string;
	category?: string;
	content: string;
	aliases?: string[];
}

export interface SkillUsageRecord {
	name: string;
	source: SkillSourceId;
	count: number;
	firstUsedAt: number;
	lastUsedAt: number;
}

export interface SkillSafetyIssue {
	code: string;
	severity: "warning" | "error";
	message: string;
}

let usageWriteQueue = Promise.resolve();

function dataRoot(): string {
	return resolve(process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience"));
}

function managedRoot(kind: ManagedSkillKind): string {
	return resolve(dataRoot(), kind === "user" ? "user-skills" : "learned-skills");
}

function installedRoot(): string {
	return resolve(dataRoot(), "installed-skills");
}

function usagePath(): string {
	return resolve(dataRoot(), "skill-usage.json");
}

function assertSkillName(name: string): void {
	if (!SKILL_NAME_RE.test(name) || name.length > 64) {
		throw new Error("Skill name must be lowercase kebab-case and at most 64 characters");
	}
}

function childPath(root: string, name: string): string {
	assertSkillName(name);
	const path = resolve(root, name);
	if (!path.startsWith(`${resolve(root)}${sep}`)) throw new Error("Skill path escapes its managed root");
	return path;
}

export function auditSkillContent(content: string): SkillSafetyIssue[] {
	const issues: SkillSafetyIssue[] = [];
	const checks: Array<[RegExp, SkillSafetyIssue]> = [
		[
			/\bignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions\b/i,
			{ code: "prompt_override", severity: "error", message: "Contains a prompt-override directive" },
		],
		[
			/\b(?:must|always)\s+(?:run|load|invoke|use)\s+this\s+skill\b/i,
			{ code: "forced_persistence", severity: "error", message: "Contains a forced-persistence directive" },
		],
		[
			/\brm\s+-rf\s+\/(?:\s|$)/i,
			{
				code: "destructive_root_delete",
				severity: "error",
				message: "Contains a destructive root deletion command",
			},
		],
		[
			/\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b/i,
			{ code: "remote_shell_pipe", severity: "warning", message: "Pipes remote content into a shell" },
		],
		[
			/\b(?:API_KEY|AUTH_TOKEN|PASSWORD)\b[^\n]{0,80}\b(?:curl|wget|nc)\b/i,
			{ code: "credential_exfiltration", severity: "error", message: "May transmit credential material" },
		],
	];
	for (const [pattern, issue] of checks) if (pattern.test(content)) issues.push(issue);
	return issues;
}

function validateManagedSkill(input: ManagedSkillInput): ManagedSkillInput {
	assertSkillName(input.name);
	const description = input.description
		.replace(/[\r\n\t]+/g, " ")
		.replace(/[<>]/g, "")
		.trim();
	if (!description || description.length > 1024) throw new Error("Skill description must contain 1-1024 characters");
	if (!input.content.trim()) throw new Error("Skill content is required");
	if (Buffer.byteLength(input.content, "utf8") > MAX_SKILL_BYTES) throw new Error("Skill content exceeds 2 MiB");
	const blocking = auditSkillContent(input.content).filter((issue) => issue.severity === "error");
	if (blocking.length > 0) throw new Error(blocking.map((issue) => issue.message).join("; "));
	const aliases = (input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
	for (const alias of aliases) assertSkillName(alias);
	return {
		...input,
		description,
		category:
			input.category
				?.split("/")
				.map((segment) =>
					segment
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-+|-+$/g, ""),
				)
				.filter(Boolean)
				.join("/") || "general",
		content: sanitizeSkillContent(input.content.trim()),
		aliases: [...new Set(aliases)].sort(),
	};
}

export async function saveManagedSkill(kind: ManagedSkillKind, input: ManagedSkillInput): Promise<string> {
	const validated = validateManagedSkill(input);
	const root = managedRoot(kind);
	const directory = childPath(root, validated.name);
	await mkdir(root, { recursive: true, mode: 0o700 });
	const existing = await lstat(directory).catch(() => undefined);
	if (existing?.isSymbolicLink()) throw new Error("Refusing to replace a symlinked skill directory");
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const filePath = join(directory, "SKILL.md");
	const temporary = join(directory, `.SKILL.${randomUUID()}.tmp`);
	const aliases = validated.aliases?.length
		? `aliases:\n${validated.aliases.map((alias) => `  - ${alias}`).join("\n")}\n`
		: "";
	const document = `---\nname: ${validated.name}\ndescription: ${JSON.stringify(validated.description)}\ncategory: ${validated.category}\n${aliases}---\n\n${validated.content}\n`;
	await writeFile(temporary, document, { encoding: "utf8", mode: 0o600 });
	await rename(temporary, filePath);
	return filePath;
}

export async function deleteManagedSkill(kind: ManagedSkillKind, name: string): Promise<boolean> {
	const path = childPath(managedRoot(kind), name);
	const metadata = await lstat(path).catch(() => undefined);
	if (!metadata) return false;
	if (metadata.isSymbolicLink()) throw new Error("Refusing to follow a symlinked skill directory");
	await rm(path, { recursive: true, force: false });
	return true;
}

async function inspectInstalledTree(root: string): Promise<void> {
	let files = 0;
	let skillFiles = 0;
	const visit = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entry.name === ".git") continue;
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Installed source contains a symlink: ${path}`);
			if (entry.isDirectory()) {
				await visit(path);
				continue;
			}
			files++;
			if (files > MAX_INSTALL_FILES) throw new Error(`Installed source exceeds ${MAX_INSTALL_FILES} files`);
			const metadata = await stat(path);
			if (metadata.size > MAX_SKILL_BYTES) throw new Error(`Installed file exceeds 2 MiB: ${path}`);
			if (entry.name !== "SKILL.md") continue;
			skillFiles++;
			const blocking = auditSkillContent(await readFile(path, "utf8")).filter((issue) => issue.severity === "error");
			if (blocking.length > 0) throw new Error(`${path}: ${blocking.map((issue) => issue.message).join("; ")}`);
		}
	};
	await visit(root);
	if (skillFiles === 0) throw new Error("Installed source contains no SKILL.md files");
}

export async function installSkillSource(url: string): Promise<{ id: string; path: string }> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("Skill source must be a valid HTTPS Git URL");
	}
	if (parsed.protocol !== "https:") throw new Error("Only HTTPS Git URLs are accepted");
	if (parsed.username || parsed.password) throw new Error("Credential-bearing Git URLs are not accepted");
	const repositoryName = (basename(parsed.pathname, ".git").replace(/[^a-zA-Z0-9_-]+/g, "-") || "skills").slice(0, 48);
	const id = `${repositoryName}-${createHash("sha256").update(parsed.toString()).digest("hex").slice(0, 10)}`;
	const normalizedId = id.toLowerCase().replace(/_/g, "-");
	const root = installedRoot();
	const target = childPath(root, normalizedId);
	const temporary = `${target}.${randomUUID()}.tmp`;
	await mkdir(root, { recursive: true, mode: 0o700 });
	try {
		await execFileAsync("git", ["clone", "--depth", "1", "--filter=blob:none", "--", parsed.toString(), temporary], {
			timeout: 120_000,
			maxBuffer: 1024 * 1024,
		});
		await inspectInstalledTree(temporary);
		await rm(join(temporary, ".git"), { recursive: true, force: true });
		await rm(target, { recursive: true, force: true });
		await rename(temporary, target);
		return { id: normalizedId, path: target };
	} catch (error) {
		await rm(temporary, { recursive: true, force: true });
		throw error;
	}
}

export async function deleteInstalledSkillSource(id: string): Promise<boolean> {
	const path = childPath(installedRoot(), id);
	const metadata = await lstat(path).catch(() => undefined);
	if (!metadata) return false;
	if (metadata.isSymbolicLink()) throw new Error("Refusing to follow a symlinked installed source");
	await rm(path, { recursive: true, force: false });
	return true;
}

export async function readSkillUsage(): Promise<SkillUsageRecord[]> {
	try {
		const parsed = JSON.parse(await readFile(usagePath(), "utf8")) as { skills?: SkillUsageRecord[] };
		return (parsed.skills ?? []).filter((record) => SKILL_NAME_RE.test(record.name));
	} catch {
		return [];
	}
}

export function recordSkillUsage(name: string, source: SkillSourceId): Promise<void> {
	usageWriteQueue = usageWriteQueue
		.catch(() => undefined)
		.then(async () => {
			assertSkillName(name);
			const usage = await readSkillUsage();
			const now = Date.now();
			const existing = usage.find((record) => record.name === name);
			if (existing) {
				existing.count++;
				existing.lastUsedAt = now;
				existing.source = source;
			} else {
				usage.push({ name, source, count: 1, firstUsedAt: now, lastUsedAt: now });
			}
			const path = usagePath();
			await mkdir(dirname(path), { recursive: true, mode: 0o700 });
			const temporary = `${path}.${process.pid}.tmp`;
			await writeFile(temporary, `${JSON.stringify({ version: 1, skills: usage }, null, 2)}\n`, {
				encoding: "utf8",
				mode: 0o600,
			});
			await rename(temporary, path);
		});
	return usageWriteQueue;
}
