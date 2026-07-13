import { exec, execFile } from "node:child_process";
import {
	glob as fsGlob,
	readFile as fsReadFile,
	writeFile as fsWriteFile,
	readdir,
	realpath,
	stat,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve as resolvePath, sep } from "node:path";
import { promisify } from "node:util";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { type Static, Type } from "typebox";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface BasicToolWorkspace {
	directory: string;
	worktree?: string;
	projectDirectory?: string;
	/** Read-only root for progressively disclosed scientific Resource packages. */
	resourceDirectory?: string;
}

function isInside(root: string, candidate: string): boolean {
	const path = relative(root, candidate);
	return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function resolveWorkspacePath(workspace: BasicToolWorkspace, input: string, forWrite = false): Promise<string> {
	const projectPath = input === "project" || input.startsWith("project/");
	const resourceAlias = input === "resource" || input.startsWith("resource/");
	const configuredResourceRoot = workspace.resourceDirectory ? resolvePath(workspace.resourceDirectory) : undefined;
	const absoluteResourcePath = Boolean(
		configuredResourceRoot && isAbsolute(input) && isInside(configuredResourceRoot, resolvePath(input)),
	);
	const resourcePath = Boolean(configuredResourceRoot && (resourceAlias || absoluteResourcePath));
	if (projectPath && workspace.projectDirectory && forWrite) {
		throw new Error("Project source is read-only; write generated files to the session workspace");
	}
	if (resourcePath && forWrite) {
		throw new Error("Resource packages are read-only; write generated files to the session workspace");
	}
	const selectedRoot = resourcePath
		? (configuredResourceRoot as string)
		: projectPath && workspace.projectDirectory
			? workspace.projectDirectory
			: workspace.directory;
	const relativeInput = resourcePath
		? absoluteResourcePath
			? relative(configuredResourceRoot as string, resolvePath(input)) || "."
			: input.replace(/^resource\/?/, "") || "."
		: projectPath && workspace.projectDirectory
			? input.replace(/^project\/?/, "") || "."
			: input;
	if (projectPath && /^\.deepscience\/workspaces(?:\/|$)/.test(relativeInput)) {
		throw new Error("Other session workspaces are not available through project source access");
	}
	const root = await realpath(resolvePath(selectedRoot));
	const candidate = resolvePath(root, relativeInput);
	if (!isInside(root, candidate)) throw new Error(`Path escapes session workspace: ${input}`);

	if (!forWrite) {
		const canonical = await realpath(candidate);
		if (!isInside(root, canonical)) throw new Error(`Path escapes session workspace through a symlink: ${input}`);
		return canonical;
	}
	if (candidate === root) return root;

	let parent = dirname(candidate);
	while (isInside(root, parent)) {
		try {
			const canonicalParent = await realpath(parent);
			if (!isInside(root, canonicalParent))
				throw new Error(`Path escapes session workspace through a symlink: ${input}`);
			return candidate;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			if (parent === root) break;
			parent = dirname(parent);
		}
	}
	throw new Error(`Unable to resolve path inside session workspace: ${input}`);
}

const textResult = (text: string, details?: Record<string, unknown>) => ({
	content: [{ type: "text" as const, text }],
	details: details ?? {},
});

// ── Read ───────────────────────────────────────────────────────────────────

const readSchema = Type.Object({
	path: Type.String({
		description:
			"Path inside the session workspace, project/<path> for project source, or resource/<path>/an exposed Resource absolute path for read-only Resource files",
	}),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

function createReadTool(workspace: BasicToolWorkspace): AgentTool<typeof readSchema> {
	return {
		name: "read",
		label: "Read",
		description: "Read the contents of a file. Supports line offset and limit for partial reads.",
		parameters: readSchema,
		async execute(_id, params) {
			const absPath = await resolveWorkspacePath(workspace, params.path);
			const content = await fsReadFile(absPath, "utf-8");
			let lines = content.split("\n");
			const offset = params.offset ?? 1;
			const limit = params.limit ?? lines.length;
			lines = lines.slice(offset - 1, offset - 1 + limit);
			return textResult(`[${params.path}]\n${lines.map((l, i) => `${offset + i}: ${l}`).join("\n")}`, {
				path: params.path,
				lines: lines.length,
			});
		},
	};
}

// ── Write ──────────────────────────────────────────────────────────────────

const writeSchema = Type.Object({
	path: Type.String({ description: "Path to write, resolved inside the current session workspace" }),
	content: Type.String({ description: "Content to write" }),
});

function createWriteTool(workspace: BasicToolWorkspace): AgentTool<typeof writeSchema> {
	return {
		name: "write",
		label: "Write",
		description: "Write content to a file, creating it if it doesn't exist.",
		parameters: writeSchema,
		async execute(_id, params) {
			const absPath = await resolveWorkspacePath(workspace, params.path, true);
			await fsWriteFile(absPath, params.content, "utf-8");
			return textResult(`Wrote ${params.content.length} bytes to ${params.path}`, { path: params.path });
		},
	};
}

// ── Bash ───────────────────────────────────────────────────────────────────

const bashSchema = Type.Object({
	command: Type.String({ description: "Shell command to execute" }),
	cwd: Type.Optional(Type.String({ description: "Working directory inside the session workspace" })),
	timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default 120)" })),
});

function createBashTool(workspace: BasicToolWorkspace): AgentTool<typeof bashSchema> {
	const environment: NodeJS.ProcessEnv = {
		...process.env,
		DEEPSCIENCE_SESSION_WORKSPACE: resolvePath(workspace.directory),
	};
	if (workspace.projectDirectory) environment.DEEPSCIENCE_PROJECT_ROOT = resolvePath(workspace.projectDirectory);
	if (workspace.resourceDirectory) environment.DEEPSCIENCE_RESOURCE_ROOT = resolvePath(workspace.resourceDirectory);
	return {
		name: "bash",
		label: "Bash",
		description:
			"Execute a shell command in the Session workspace and return stdout/stderr. DEEPSCIENCE_SESSION_WORKSPACE, DEEPSCIENCE_PROJECT_ROOT, and DEEPSCIENCE_RESOURCE_ROOT provide stable runtime paths when available; use them instead of guessing launch or repository directories.",
		parameters: bashSchema,
		async execute(_id, params, signal) {
			const timeout = (params.timeout ?? 120) * 1000;
			const cwd = await resolveWorkspacePath(workspace, params.cwd ?? ".", true);
			if (!(await stat(cwd)).isDirectory()) throw new Error(`Command cwd is not a directory: ${params.cwd}`);
			try {
				const result = await execAsync(params.command, {
					cwd,
					env: environment,
					timeout,
					maxBuffer: 1024 * 1024 * 10,
					encoding: "utf-8",
					signal,
				});
				const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
				return textResult(output || "(no output)", { exitCode: 0 });
			} catch (err: unknown) {
				const e = err as { stdout?: string; stderr?: string; status?: number };
				const combined = [e.stdout, e.stderr].filter(Boolean).join("\n") || "(no output)";
				return textResult(combined, { exitCode: e.status ?? 1, error: true });
			}
		},
	};
}

// ── Glob ───────────────────────────────────────────────────────────────────

const globSchema = Type.Object({
	pattern: Type.String({ description: "Glob pattern (e.g. **/*.ts, src/**/*.py)" }),
	path: Type.Optional(
		Type.String({ description: "Workspace base directory, project/<path>, or read-only resource/<path>" }),
	),
});

function createGlobTool(workspace: BasicToolWorkspace): AgentTool<typeof globSchema> {
	return {
		name: "glob",
		label: "Glob",
		description: "Find files matching a glob pattern. Returns matching file paths.",
		parameters: globSchema,
		async execute(_id, params) {
			const base = await resolveWorkspacePath(workspace, params.path ?? ".");
			const files: string[] = [];
			for await (const file of fsGlob(params.pattern, { cwd: base })) {
				files.push(resolvePath(base, file));
				if (files.length === 100) break;
			}
			return textResult(files.join("\n") || "(no matches)", { count: files.length });
		},
	};
}

// ── Grep ───────────────────────────────────────────────────────────────────

const grepSchema = Type.Object({
	pattern: Type.String({ description: "Regex pattern to search for" }),
	path: Type.Optional(Type.String({ description: "Workspace path, project/<path>, or read-only resource/<path>" })),
	include: Type.Optional(Type.String({ description: "File glob to include (e.g. *.py)" })),
});

function createGrepTool(workspace: BasicToolWorkspace): AgentTool<typeof grepSchema> {
	return {
		name: "grep",
		label: "Grep",
		description:
			"Search file contents using a regex pattern. Returns matching lines with file paths and line numbers.",
		parameters: grepSchema,
		async execute(_id, params, signal) {
			const base = await resolveWorkspacePath(workspace, params.path ?? ".");
			const metadata = await stat(base);
			const cwd = metadata.isDirectory() ? base : dirname(base);
			const target = metadata.isDirectory() ? "." : basename(base);
			const args = ["--line-number", "--with-filename", "--regexp", params.pattern];
			if (params.include) args.push("--glob", params.include);
			args.push(target);
			try {
				const result = await execFileAsync("rg", args, {
					cwd,
					encoding: "utf-8",
					timeout: 30000,
					maxBuffer: 1024 * 1024 * 10,
					signal,
				});
				const lines = result.stdout.split("\n").slice(0, 100).join("\n");
				return textResult(lines || "(no matches)", { pattern: params.pattern });
			} catch (error: unknown) {
				const failure = error as { code?: number | string; stdout?: string; stderr?: string; message?: string };
				if (failure.code === 1) return textResult("(no matches)", { pattern: params.pattern });
				if (failure.stdout) {
					return textResult(failure.stdout.split("\n").slice(0, 100).join("\n"), { pattern: params.pattern });
				}
				const message = failure.stderr?.trim() || failure.message || "unknown grep failure";
				return textResult(`grep failed: ${message}`, { pattern: params.pattern, error: true });
			}
		},
	};
}

// ── List ───────────────────────────────────────────────────────────────────

const listSchema = Type.Object({
	path: Type.Optional(
		Type.String({ description: "Workspace directory, project/<path>, or read-only resource/<path>" }),
	),
});

function createListTool(workspace: BasicToolWorkspace): AgentTool<typeof listSchema> {
	return {
		name: "ls",
		label: "List",
		description: "List files and directories in a path.",
		parameters: listSchema,
		async execute(_id, params) {
			const dir = await resolveWorkspacePath(workspace, params.path ?? ".");
			const entries = await readdir(dir, { withFileTypes: true });
			const lines = entries.map((e) => `${e.isDirectory() ? "d" : "-"} ${e.name}`);
			return textResult(lines.join("\n"), { count: entries.length });
		},
	};
}

// ── Artifact publication ───────────────────────────────────────────────────

const artifactSchema = Type.Object({
	title: Type.String({
		minLength: 1,
		maxLength: 120,
		description: "Short user-facing title for this important result",
	}),
	content: Type.Optional(
		Type.String({
			maxLength: 50_000,
			description:
				"Curated Markdown to render. Summarize the result; do not paste routine logs or huge raw datasets.",
		}),
	),
	kind: Type.Optional(
		Type.Union(
			[
				Type.Literal("auto"),
				Type.Literal("markdown"),
				Type.Literal("table"),
				Type.Literal("data"),
				Type.Literal("equation"),
				Type.Literal("html"),
				Type.Literal("structure"),
				Type.Literal("image"),
				Type.Literal("file"),
				Type.Literal("result"),
			],
			{ description: "Rendering hint; use auto unless a specific presentation is required" },
		),
	),
	files: Type.Optional(
		Type.Array(
			Type.Object({
				path: Type.String({ description: "Existing file path relative to the Session workspace" }),
				label: Type.Optional(Type.String({ maxLength: 120, description: "User-facing file label" })),
			}),
			{ maxItems: 20, description: "Important generated files associated with this artifact" },
		),
	),
});

function createArtifactTool(workspace: BasicToolWorkspace): AgentTool<typeof artifactSchema> {
	return {
		name: "artifact",
		label: "Publish Artifact",
		description:
			"Publish one curated, high-value result to the user's Artifacts panel. Supports Markdown, HTML, molecular structures, figures, tables, datasets, equations, reports, and decision-critical findings. Call selectively; never publish routine tool output, progress, or logs. Publish PDB, CIF, mmCIF, or MOL2 files with kind=structure for interactive 3D viewing. HTML must be self-contained because scripts and external resources are blocked by the renderer.",
		parameters: artifactSchema,
		async execute(_id, params) {
			const title = params.title.trim();
			const content = params.content?.trim() ?? "";
			const files: Array<{ path: string; label: string; kind: "image" | "file" }> = [];
			for (const requested of params.files ?? []) {
				if (
					isAbsolute(requested.path) ||
					requested.path === "project" ||
					requested.path.startsWith("project/") ||
					requested.path === "resource" ||
					requested.path.startsWith("resource/")
				) {
					throw new Error(`Artifact files must be relative to the Session workspace: ${requested.path}`);
				}
				const absolute = await resolveWorkspacePath(workspace, requested.path);
				if (!(await stat(absolute)).isFile()) throw new Error(`Artifact path is not a file: ${requested.path}`);
				files.push({
					path: requested.path,
					label: requested.label?.trim() || basename(requested.path),
					kind: /\.(?:png|jpe?g|gif|webp)$/i.test(requested.path) ? "image" : "file",
				});
			}
			if (!content && files.length === 0)
				throw new Error("Artifact content or at least one existing file is required");

			const references = files
				.filter((file) => !/\s/.test(file.path))
				.map(
					(file) =>
						`${file.kind === "image" ? "!" : ""}[${file.label.replaceAll("[", "").replaceAll("]", "")}](${file.path})`,
				);
			const rendered = [content, references.join("\n")].filter(Boolean).join("\n\n");
			return textResult(rendered || `Published ${files.length} file${files.length === 1 ? "" : "s"}.`, {
				artifact: {
					title,
					kind: params.kind ?? "auto",
					files,
				},
			});
		},
	};
}

export function createBasicTools(workspace: BasicToolWorkspace): AgentTool[] {
	return [
		createReadTool(workspace),
		createWriteTool(workspace),
		createBashTool(workspace),
		createGlobTool(workspace),
		createGrepTool(workspace),
		createListTool(workspace),
		createArtifactTool(workspace),
	];
}

export const basicTools: AgentTool[] = createBasicTools({ directory: process.cwd() });
export const [readTool, writeTool, bashTool, globTool, grepTool, listTool, artifactTool] = basicTools;

export type { Static };
