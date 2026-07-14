import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readdir, readFile, realpath, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REGISTRY_VERSION = 2;
const LOCAL_METADATA_VERSION = 1;
const WORKTREE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
let registryMutation: Promise<void> = Promise.resolve();

export type WorkspaceKind = "project" | "git-worktree";

export interface WorkspaceInstance {
	projectID: string;
	directory: string;
	worktree: string;
	workspaceKind: WorkspaceKind;
	vcs?: "git";
	/** User-selected Workspace root; session execution is stored below its local .deepscience directory. */
	projectDirectory?: string;
}

export interface WorkspaceProject {
	id: string;
	title: string;
	worktree: string;
	vcs?: "git";
	directories: string[];
	createdAt: number;
	updatedAt: number;
}

export interface WorkspaceDirectoryListing {
	directory: string;
	parent: string;
	directories: Array<{ name: string; path: string }>;
}

interface ProjectRegistry {
	version: number;
	projects: WorkspaceProject[];
}

interface LocalWorkspaceMetadata {
	version: number;
	projectID: string;
	directory: string;
	worktree: string;
	workspaceKind: WorkspaceKind;
	vcs?: "git";
	createdAt: number;
	updatedAt: number;
}

function dataDirectory(): string {
	return process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience");
}

function projectID(source: string): string {
	return `project_${createHash("sha256").update(source).digest("hex").slice(0, 20)}`;
}

async function gitOutput(cwd: string, args: string[]): Promise<string | undefined> {
	try {
		const result = await execFileAsync("git", args, { cwd, encoding: "utf-8", timeout: 15_000 });
		return result.stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

async function canonicalDirectory(directory: string): Promise<string> {
	const absolute = resolve(directory);
	const info = await stat(absolute);
	if (!info.isDirectory()) throw new Error(`Workspace is not a directory: ${absolute}`);
	return realpath(absolute);
}

export async function browseWorkspaceDirectories(directory = process.cwd()): Promise<WorkspaceDirectoryListing> {
	const current = await canonicalDirectory(directory);
	const entries = await readdir(current, { withFileTypes: true });
	const directories = entries
		.filter((entry) => entry.isDirectory() && ![".deepscience", ".git", "node_modules"].includes(entry.name))
		.map((entry) => ({ name: entry.name, path: resolve(current, entry.name) }))
		.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
	return {
		directory: current,
		parent: dirname(current),
		directories,
	};
}

export async function resolveWorkspaceInstance(directory = process.cwd()): Promise<WorkspaceInstance> {
	const canonical = await canonicalDirectory(directory);
	const topLevel = await gitOutput(canonical, ["rev-parse", "--show-toplevel"]);
	if (!topLevel) {
		return {
			projectID: projectID(`directory:${canonical}`),
			directory: canonical,
			worktree: canonical,
			workspaceKind: "project",
		};
	}

	const worktree = await canonicalDirectory(topLevel);
	const commonText = await gitOutput(worktree, ["rev-parse", "--git-common-dir"]);
	const commonDirectory = commonText
		? await realpath(isAbsolute(commonText) ? commonText : resolve(worktree, commonText))
		: join(worktree, ".git");
	const gitDirectoryText = await gitOutput(worktree, ["rev-parse", "--git-dir"]);
	const gitDirectory = gitDirectoryText
		? await realpath(isAbsolute(gitDirectoryText) ? gitDirectoryText : resolve(worktree, gitDirectoryText))
		: commonDirectory;

	return {
		projectID: projectID(`git:${commonDirectory}`),
		directory: canonical,
		worktree,
		workspaceKind: gitDirectory === commonDirectory ? "project" : "git-worktree",
		vcs: "git",
	};
}

function sessionWorkspacePath(projectDirectory: string, sessionID: string): string {
	if (!/^sess_[a-zA-Z0-9-]+$/.test(sessionID)) throw new Error(`Unsafe session id: ${sessionID}`);
	return resolve(projectDirectory, ".deepscience", "workspace", sessionID);
}

export async function createSessionWorkspace(options: {
	projectDirectory: string;
	sessionID: string;
	cloneFrom?: string;
}): Promise<WorkspaceInstance> {
	const project = await resolveWorkspaceInstance(options.projectDirectory);
	await ensureLocalWorkspaceMetadata(project);
	const directory = sessionWorkspacePath(project.directory, options.sessionID);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	if (options.cloneFrom) {
		for (const entry of await readdir(await canonicalDirectory(options.cloneFrom), { withFileTypes: true })) {
			await cp(resolve(options.cloneFrom, entry.name), resolve(directory, entry.name), {
				recursive: true,
				force: false,
				errorOnExist: true,
			});
		}
	}
	await mkdir(join(directory, "upload"), { recursive: true, mode: 0o700 });
	return { ...project, directory: await realpath(directory), projectDirectory: project.directory };
}

export async function openSessionWorkspace(options: {
	projectDirectory: string;
	sessionID: string;
}): Promise<WorkspaceInstance> {
	const project = await resolveWorkspaceInstance(options.projectDirectory);
	await ensureLocalWorkspaceMetadata(project);
	const directory = await canonicalDirectory(sessionWorkspacePath(project.directory, options.sessionID));
	await mkdir(join(directory, "upload"), { recursive: true, mode: 0o700 });
	return { ...project, directory, projectDirectory: project.directory };
}

async function readRegistry(): Promise<ProjectRegistry> {
	const target = join(dataDirectory(), "projects", "index.json");
	try {
		const parsed = JSON.parse(await readFile(target, "utf-8")) as ProjectRegistry;
		if (parsed.version !== REGISTRY_VERSION || !Array.isArray(parsed.projects)) {
			throw new Error(`Unsupported Project registry: ${target}`);
		}
		return parsed;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	return { version: REGISTRY_VERSION, projects: [] };
}

async function writeRegistry(registry: ProjectRegistry): Promise<void> {
	const root = join(dataDirectory(), "projects");
	await mkdir(root, { recursive: true, mode: 0o700 });
	const target = join(root, "index.json");
	const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
	await rename(temporary, target);
}

async function ensureLocalWorkspaceMetadata(instance: WorkspaceInstance): Promise<void> {
	const root = resolve(instance.directory, ".deepscience");
	const target = join(root, "workspace.json");
	let createdAt = Date.now();
	try {
		const existing = JSON.parse(await readFile(target, "utf-8")) as Partial<LocalWorkspaceMetadata>;
		if (typeof existing.createdAt === "number") createdAt = existing.createdAt;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
	}
	const metadata: LocalWorkspaceMetadata = {
		version: LOCAL_METADATA_VERSION,
		projectID: instance.projectID,
		directory: instance.directory,
		worktree: instance.worktree,
		workspaceKind: instance.workspaceKind,
		vcs: instance.vcs,
		createdAt,
		updatedAt: Date.now(),
	};
	await mkdir(root, { recursive: true, mode: 0o700 });
	const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
	await rename(temporary, target);
}

function mutateRegistry<T>(operation: () => Promise<T>): Promise<T> {
	const result = registryMutation.then(operation, operation);
	registryMutation = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

export async function registerWorkspaceInstance(instance: WorkspaceInstance): Promise<WorkspaceProject> {
	await ensureLocalWorkspaceMetadata(instance);
	return mutateRegistry(async () => {
		const registry = await readRegistry();
		const now = Date.now();
		const matching = registry.projects.filter(
			(item) => item.id === instance.projectID || resolve(item.worktree) === resolve(instance.worktree),
		);
		let project = matching.find((item) => item.id === instance.projectID) ?? matching[0];
		if (!project) {
			project = {
				id: instance.projectID,
				title: basename(instance.worktree),
				worktree: instance.worktree,
				vcs: instance.vcs,
				directories: [instance.directory],
				createdAt: now,
				updatedAt: now,
			};
			registry.projects.push(project);
		} else {
			project.id = instance.projectID;
			project.title = basename(instance.worktree);
			project.worktree = instance.worktree;
			project.createdAt = Math.min(project.createdAt, ...matching.map((item) => item.createdAt));
			project.updatedAt = now;
			project.vcs = instance.vcs;
			project.directories = [...new Set([...matching.flatMap((item) => item.directories), instance.directory])];
			registry.projects = registry.projects.filter((item) => item === project || !matching.includes(item));
		}
		await writeRegistry(registry);
		return project;
	});
}

export async function openWorkspaceProject(
	directory: string,
	create = false,
): Promise<WorkspaceProject & WorkspaceInstance> {
	const target = resolve(directory);
	if (create) await mkdir(target, { recursive: true, mode: 0o700 });
	const instance = await resolveWorkspaceInstance(target);
	const project = await registerWorkspaceInstance(instance);
	return { ...project, ...instance };
}

function isInternalWorkspaceDirectory(directory: string): boolean {
	const segments = resolve(directory).split(sep);
	const internalRoot = segments.indexOf(".deepscience");
	if (
		internalRoot >= 0 &&
		segments[internalRoot + 1] === "workspace" &&
		/^sess_[a-zA-Z0-9-]+$/.test(segments[internalRoot + 2] ?? "")
	) {
		return true;
	}

	const target = resolve(directory);
	return (
		dirname(target) === resolve(tmpdir()) &&
		/^(?:ds-(?:capability-extension|durable|sess)-|deepscience-binding-workspace-)[a-zA-Z0-9_-]+$/.test(
			basename(target),
		)
	);
}

async function isVisibleWorkspaceDirectory(directory: string): Promise<boolean> {
	if (isInternalWorkspaceDirectory(directory)) return false;
	try {
		return (await stat(directory)).isDirectory();
	} catch {
		return false;
	}
}

export async function listWorkspaceProjects(): Promise<WorkspaceProject[]> {
	return mutateRegistry(async () => {
		const registry = await readRegistry();
		const visibleProjects: WorkspaceProject[] = [];
		let changed = false;
		for (const project of registry.projects) {
			const visibility = await Promise.all(
				project.directories.map(async (directory) => ({
					directory,
					visible: await isVisibleWorkspaceDirectory(directory),
				})),
			);
			const directories = visibility.filter((item) => item.visible).map((item) => item.directory);
			if (directories.length !== project.directories.length) changed = true;
			if (directories.length === 0) {
				changed = true;
				continue;
			}
			let normalized = { ...project, directories };
			try {
				const identity = await resolveWorkspaceInstance(project.worktree);
				if (
					project.id !== identity.projectID ||
					project.worktree !== identity.worktree ||
					project.vcs !== identity.vcs
				) {
					changed = true;
				}
				normalized = {
					...normalized,
					id: identity.projectID,
					title: basename(identity.worktree),
					worktree: identity.worktree,
					vcs: identity.vcs,
				};
			} catch {
				// The visible directories remain usable even if project identity cannot be refreshed.
			}
			visibleProjects.push(normalized);
		}
		const projects = [...visibleProjects]
			.sort((left, right) => right.updatedAt - left.updatedAt)
			.reduce<WorkspaceProject[]>((merged, project) => {
				const existing = merged.find((item) => resolve(item.worktree) === resolve(project.worktree));
				if (!existing) {
					merged.push(project);
					return merged;
				}
				existing.directories = [...new Set([...existing.directories, ...project.directories])];
				existing.createdAt = Math.min(existing.createdAt, project.createdAt);
				existing.updatedAt = Math.max(existing.updatedAt, project.updatedAt);
				existing.vcs ??= project.vcs;
				changed = true;
				return merged;
			}, []);
		projects.sort((left, right) => right.updatedAt - left.updatedAt);
		if (changed) await writeRegistry({ ...registry, projects });
		return projects;
	});
}

export async function listGitWorktrees(directory: string): Promise<WorkspaceInstance[]> {
	const instance = await resolveWorkspaceInstance(directory);
	if (instance.vcs !== "git") throw new Error("Workspace is not a Git repository");
	const output = await gitOutput(instance.worktree, ["worktree", "list", "--porcelain"]);
	if (!output) return [instance];
	const paths = output
		.split(/\n\n+/)
		.map((block) => block.match(/^worktree (.+)$/m)?.[1])
		.filter((path): path is string => Boolean(path));
	return Promise.all(paths.map((path) => resolveWorkspaceInstance(path)));
}

export async function createGitWorktree(options: {
	directory: string;
	name: string;
	branch?: string;
	baseRef?: string;
}): Promise<WorkspaceInstance> {
	if (!WORKTREE_NAME_RE.test(options.name)) throw new Error("Invalid worktree name");
	const source = await resolveWorkspaceInstance(options.directory);
	if (source.vcs !== "git") throw new Error("Workspace is not a Git repository");
	const root = join(dirname(source.worktree), `${basename(source.worktree)}-worktrees`);
	await mkdir(root, { recursive: true, mode: 0o700 });
	const target = join(root, options.name);
	const branch = options.branch ?? `deepscience/${options.name}`;
	if (!branch || branch.startsWith("-") || /[\s~^:?*[\\]/.test(branch)) throw new Error("Invalid Git branch name");
	const args = ["worktree", "add", "-b", branch, target];
	if (options.baseRef) args.push(options.baseRef);
	await execFileAsync("git", args, { cwd: source.worktree, encoding: "utf-8", timeout: 60_000 });
	const created = await resolveWorkspaceInstance(target);
	await registerWorkspaceInstance(created);
	return created;
}

function isInside(parent: string, child: string): boolean {
	const path = relative(parent, child);
	return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

export async function removeGitWorktree(directory: string, force = false): Promise<void> {
	const canonical = await canonicalDirectory(directory);
	const instance = await resolveWorkspaceInstance(canonical);
	if (instance.vcs !== "git" || instance.workspaceKind !== "git-worktree") {
		throw new Error("Only linked Git worktrees can be removed");
	}
	const commonText = (await gitOutput(canonical, ["rev-parse", "--git-common-dir"])) ?? ".git";
	const commonDirectory = await realpath(isAbsolute(commonText) ? commonText : resolve(canonical, commonText));
	const projectDirectory = dirname(commonDirectory);
	const managedRoot = resolve(dirname(projectDirectory), `${basename(projectDirectory)}-worktrees`);
	if (!isInside(managedRoot, canonical) || canonical === managedRoot) {
		throw new Error("Only DeepScience-managed worktrees can be removed");
	}
	const args = ["worktree", "remove"];
	if (force) args.push("--force");
	args.push(canonical);
	await rm(join(canonical, ".deepscience", "workspace.json"), { force: true });
	await rmdir(join(canonical, ".deepscience")).catch((error: unknown) => {
		const code = (error as NodeJS.ErrnoException).code;
		if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST") throw error;
	});
	try {
		await execFileAsync("git", args, { cwd: projectDirectory, encoding: "utf-8", timeout: 60_000 });
	} catch (error) {
		await ensureLocalWorkspaceMetadata(instance);
		throw error;
	}
	await rm(canonical, { recursive: true, force: true });
	await mutateRegistry(async () => {
		const registry = await readRegistry();
		const project = registry.projects.find((item) => item.id === instance.projectID);
		if (!project) return;
		project.directories = project.directories.filter((item) => item !== canonical);
		project.updatedAt = Date.now();
		await writeRegistry(registry);
	});
}
