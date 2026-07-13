import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, readFile, realpath, stat } from "node:fs/promises";
import { arch, homedir, platform, release } from "node:os";
import { basename, delimiter, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 10_000;
const MAX_ENVIRONMENTS = 200;
const MAX_OUTPUT_BYTES = 1024 * 1024;

const environmentSchema = Type.Object({});

const MANAGERS = [
	{ name: "conda", versionArgs: ["--version"], environmentArgs: ["env", "list", "--json"] },
	{ name: "mamba", versionArgs: ["--version"], environmentArgs: ["env", "list", "--json"] },
	{ name: "micromamba", versionArgs: ["--version"], environmentArgs: ["env", "list", "--json"] },
	{ name: "uv", versionArgs: ["--version"] },
	{ name: "poetry", versionArgs: ["--version"] },
	{ name: "pipenv", versionArgs: ["--version"] },
	{ name: "pyenv", versionArgs: ["--version"] },
	{ name: "virtualenv", versionArgs: ["--version"] },
	{ name: "pdm", versionArgs: ["--version"] },
	{ name: "hatch", versionArgs: ["--version"] },
	{ name: "pixi", versionArgs: ["--version"] },
	{ name: "rye", versionArgs: ["--version"] },
	{ name: "tox", versionArgs: ["--version"] },
	{ name: "nox", versionArgs: ["--version"] },
] as const;

const PROJECT_MARKERS = new Map<string, string>([
	["pyproject.toml", "Python project configuration"],
	["uv.lock", "uv lockfile"],
	["poetry.lock", "Poetry lockfile"],
	["Pipfile", "Pipenv project"],
	["Pipfile.lock", "Pipenv lockfile"],
	["environment.yml", "Conda environment specification"],
	["environment.yaml", "Conda environment specification"],
	["conda-lock.yml", "Conda lockfile"],
	["conda-lock.yaml", "Conda lockfile"],
	["pixi.toml", "Pixi project"],
	["pixi.lock", "Pixi lockfile"],
	["requirements.txt", "pip requirements"],
	["setup.py", "Python package setup"],
	["setup.cfg", "Python package configuration"],
	["tox.ini", "tox environments"],
	["noxfile.py", "nox environments"],
	[".python-version", "pyenv version selection"],
]);

type ManagerName = (typeof MANAGERS)[number]["name"];

interface RuntimeToolWorkspace {
	directory: string;
	projectDirectory?: string;
}

interface CommandResult {
	ok: boolean;
	stdout: string;
	stderr: string;
	exitCode?: number | string;
}

interface PythonInterpreter {
	command: string;
	path: string;
	version?: string;
	implementation?: string;
	prefix?: string;
	basePrefix?: string;
	isVirtualEnvironment?: boolean;
	venvModuleAvailable?: boolean;
	error?: string;
}

interface EnvironmentRecord {
	kind: string;
	name: string;
	path?: string;
	active: boolean;
	source: string;
}

interface ManagerRecord {
	name: ManagerName;
	installed: boolean;
	path?: string;
	version?: string;
	active: boolean;
	environmentCount?: number;
	diagnostic?: string;
}

interface ProjectMarker {
	root: "project" | "session";
	path: string;
	type: string;
}

interface DetectionOptions {
	env?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
	arch?: string;
	release?: string;
	homeDirectory?: string;
}

function firstLine(value: string): string | undefined {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
}

function commandExtensions(os: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
	if (os !== "win32") return [""];
	return (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
		.split(";")
		.filter(Boolean)
		.map((extension) => extension.toLowerCase());
}

async function findExecutable(
	command: string,
	env: NodeJS.ProcessEnv,
	os: NodeJS.Platform,
): Promise<string | undefined> {
	const extensions = commandExtensions(os, env);
	for (const pathEntry of (env.PATH ?? "").split(delimiter).filter(Boolean)) {
		for (const extension of extensions) {
			const candidate = join(pathEntry, os === "win32" ? `${command}${extension}` : command);
			try {
				await access(candidate, constants.X_OK);
				return await realpath(candidate);
			} catch {
				// Continue through PATH without treating a missing candidate as a diagnostic.
			}
		}
	}
	return undefined;
}

async function runCommand(
	executable: string,
	args: readonly string[],
	cwd: string,
	env: NodeJS.ProcessEnv,
	signal?: AbortSignal,
): Promise<CommandResult> {
	try {
		const result = await execFileAsync(executable, [...args], {
			cwd,
			env,
			encoding: "utf8",
			timeout: COMMAND_TIMEOUT_MS,
			maxBuffer: MAX_OUTPUT_BYTES,
			signal,
		});
		return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
	} catch (error: unknown) {
		if (signal?.aborted) throw new Error("Runtime environment inspection aborted");
		const failure = error as {
			code?: number | string;
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		return {
			ok: false,
			stdout: failure.stdout?.trim() ?? "",
			stderr: failure.stderr?.trim() || failure.message || "Command failed",
			exitCode: failure.code,
		};
	}
}

function managerIsActive(name: ManagerName, env: NodeJS.ProcessEnv): boolean {
	switch (name) {
		case "conda":
			return Boolean(env.CONDA_PREFIX);
		case "mamba":
		case "micromamba":
			return Boolean(env.CONDA_PREFIX && (env.MAMBA_EXE || env.MAMBA_ROOT_PREFIX));
		case "poetry":
			return env.POETRY_ACTIVE === "1";
		case "pipenv":
			return env.PIPENV_ACTIVE === "1";
		case "pyenv":
			return Boolean(env.PYENV_VERSION);
		case "virtualenv":
			return Boolean(env.VIRTUAL_ENV);
		default:
			return false;
	}
}

function parseEnvironmentList(output: string, manager: string, activePrefix: string | undefined): EnvironmentRecord[] {
	try {
		const parsed = JSON.parse(output) as { envs?: unknown };
		if (!Array.isArray(parsed.envs)) return [];
		return parsed.envs
			.filter((entry): entry is string => typeof entry === "string")
			.slice(0, MAX_ENVIRONMENTS)
			.map((path) => ({
				kind: manager,
				name: basename(path),
				path,
				active: activePrefix ? resolve(path) === resolve(activePrefix) : false,
				source: `${manager} env list`,
			}));
	} catch {
		return [];
	}
}

async function detectManager(
	definition: (typeof MANAGERS)[number],
	cwd: string,
	env: NodeJS.ProcessEnv,
	os: NodeJS.Platform,
	signal?: AbortSignal,
): Promise<{ manager: ManagerRecord; environments: EnvironmentRecord[] }> {
	const path = await findExecutable(definition.name, env, os);
	if (!path) return { manager: { name: definition.name, installed: false, active: false }, environments: [] };
	const versionResult = await runCommand(path, definition.versionArgs, cwd, env, signal);
	let environments: EnvironmentRecord[] = [];
	let diagnostic = versionResult.ok ? undefined : versionResult.stderr;
	if ("environmentArgs" in definition) {
		const listResult = await runCommand(path, definition.environmentArgs, cwd, env, signal);
		if (listResult.ok) environments = parseEnvironmentList(listResult.stdout, definition.name, env.CONDA_PREFIX);
		else diagnostic = `Environment listing failed: ${firstLine(listResult.stderr) ?? "unknown error"}`;
	}
	return {
		manager: {
			name: definition.name,
			installed: true,
			path,
			version: firstLine(versionResult.stdout || versionResult.stderr),
			active: managerIsActive(definition.name, env),
			environmentCount: environments.length || undefined,
			diagnostic,
		},
		environments,
	};
}

async function detectPython(
	command: string,
	cwd: string,
	env: NodeJS.ProcessEnv,
	os: NodeJS.Platform,
	signal?: AbortSignal,
): Promise<PythonInterpreter | undefined> {
	const path = await findExecutable(command, env, os);
	if (!path) return undefined;
	const code = [
		"import importlib.util, json, platform, sys",
		"print(json.dumps({'version': platform.python_version(), 'implementation': platform.python_implementation(), 'executable': sys.executable, 'prefix': sys.prefix, 'basePrefix': getattr(sys, 'base_prefix', sys.prefix), 'isVirtualEnvironment': sys.prefix != getattr(sys, 'base_prefix', sys.prefix) or hasattr(sys, 'real_prefix'), 'venvModuleAvailable': importlib.util.find_spec('venv') is not None}))",
	].join("; ");
	const result = await runCommand(path, ["-c", code], cwd, env, signal);
	if (!result.ok) return { command, path, error: firstLine(result.stderr) ?? "Interpreter probe failed" };
	try {
		const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
		return {
			command,
			path: typeof parsed.executable === "string" ? parsed.executable : path,
			version: typeof parsed.version === "string" ? parsed.version : undefined,
			implementation: typeof parsed.implementation === "string" ? parsed.implementation : undefined,
			prefix: typeof parsed.prefix === "string" ? parsed.prefix : undefined,
			basePrefix: typeof parsed.basePrefix === "string" ? parsed.basePrefix : undefined,
			isVirtualEnvironment:
				typeof parsed.isVirtualEnvironment === "boolean" ? parsed.isVirtualEnvironment : undefined,
			venvModuleAvailable: typeof parsed.venvModuleAvailable === "boolean" ? parsed.venvModuleAvailable : undefined,
		};
	} catch {
		return { command, path, error: "Interpreter returned invalid probe JSON" };
	}
}

async function existingDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function virtualEnvironmentAt(path: string): Promise<EnvironmentRecord | undefined> {
	try {
		const config = await readFile(join(path, "pyvenv.cfg"), "utf8");
		const version = config.match(/^version\s*=\s*(.+)$/im)?.[1]?.trim();
		return {
			kind: "venv",
			name: basename(path),
			path: await realpath(path),
			active: false,
			source: version ? `pyvenv.cfg (Python ${version})` : "pyvenv.cfg",
		};
	} catch {
		return undefined;
	}
}

async function detectProjectEnvironmentDirectories(root: string): Promise<EnvironmentRecord[]> {
	if (!(await existingDirectory(root))) return [];
	const records: EnvironmentRecord[] = [];
	const rootEnvironment = await virtualEnvironmentAt(root);
	if (rootEnvironment) records.push(rootEnvironment);
	const entries = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).slice(0, 250);
	for (const entry of entries) {
		const candidate = join(root, entry.name);
		const direct = await virtualEnvironmentAt(candidate);
		if (direct) records.push(direct);
		if (![".tox", ".nox"].includes(entry.name)) continue;
		for (const nested of (await readdir(candidate, { withFileTypes: true })).filter((item) => item.isDirectory())) {
			const environment = await virtualEnvironmentAt(join(candidate, nested.name));
			if (environment) records.push(environment);
		}
	}
	return records;
}

async function detectProjectMarkers(
	root: string,
	rootKind: ProjectMarker["root"],
): Promise<{ markers: ProjectMarker[]; pyprojectManagers: string[] }> {
	if (!(await existingDirectory(root))) return { markers: [], pyprojectManagers: [] };
	const entries = await readdir(root, { withFileTypes: true });
	const markers: ProjectMarker[] = [];
	const pyprojectManagers: string[] = [];
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const markerType =
			PROJECT_MARKERS.get(entry.name) ??
			(entry.name.startsWith("requirements") && extname(entry.name) === ".txt" ? "pip requirements" : undefined);
		if (!markerType) continue;
		const path = join(root, entry.name);
		markers.push({ root: rootKind, path, type: markerType });
		if (entry.name !== "pyproject.toml") continue;
		try {
			const content = await readFile(path, "utf8");
			for (const manager of ["poetry", "pdm", "hatch", "uv"]) {
				if (content.includes(`[tool.${manager}]`)) pyprojectManagers.push(manager);
			}
		} catch {
			// The marker remains useful even when its contents cannot be read.
		}
	}
	return { markers, pyprojectManagers };
}

function deduplicateEnvironments(records: EnvironmentRecord[], activePrefixes: Set<string>): EnvironmentRecord[] {
	const seen = new Set<string>();
	const result: EnvironmentRecord[] = [];
	for (const record of records) {
		const key = record.path ? resolve(record.path) : `${record.kind}:${record.name}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push({
			...record,
			active: record.active || Boolean(record.path && activePrefixes.has(resolve(record.path))),
		});
	}
	return result.slice(0, MAX_ENVIRONMENTS);
}

export async function inspectRuntimeEnvironment(
	workspace: RuntimeToolWorkspace,
	options: DetectionOptions = {},
	signal?: AbortSignal,
): Promise<Record<string, unknown>> {
	const env = options.env ?? process.env;
	const os = options.platform ?? platform();
	const projectDirectory = resolve(workspace.projectDirectory ?? workspace.directory);
	const sessionDirectory = resolve(workspace.directory);
	const roots: Array<{ path: string; kind: ProjectMarker["root"] }> = [{ path: projectDirectory, kind: "project" }];
	if (sessionDirectory !== projectDirectory) roots.push({ path: sessionDirectory, kind: "session" });

	const [managerResults, pythonResults, rootResults] = await Promise.all([
		Promise.all(MANAGERS.map((manager) => detectManager(manager, projectDirectory, env, os, signal))),
		Promise.all(["python", "python3"].map((command) => detectPython(command, projectDirectory, env, os, signal))),
		Promise.all(
			roots.map(async (root) => ({
				...(await detectProjectMarkers(root.path, root.kind)),
				environments: await detectProjectEnvironmentDirectories(root.path),
			})),
		),
	]);

	const activePrefixes = new Set(
		[
			env.CONDA_PREFIX,
			env.VIRTUAL_ENV,
			...pythonResults.map((result) => (result?.isVirtualEnvironment && result.prefix ? result.prefix : undefined)),
		]
			.filter((value): value is string => Boolean(value))
			.map((value) => resolve(value)),
	);
	const activatedEnvironments: EnvironmentRecord[] = [];
	if (env.CONDA_PREFIX) {
		activatedEnvironments.push({
			kind: env.MAMBA_EXE || env.MAMBA_ROOT_PREFIX ? "conda-compatible" : "conda",
			name: env.CONDA_DEFAULT_ENV || basename(env.CONDA_PREFIX),
			path: env.CONDA_PREFIX,
			active: true,
			source: "process activation variables",
		});
	}
	if (env.VIRTUAL_ENV) {
		activatedEnvironments.push({
			kind: "virtualenv",
			name: basename(env.VIRTUAL_ENV),
			path: env.VIRTUAL_ENV,
			active: true,
			source: "VIRTUAL_ENV",
		});
	}
	const environments = deduplicateEnvironments(
		[
			...activatedEnvironments,
			...managerResults.flatMap((result) => result.environments),
			...rootResults.flatMap((result) => result.environments),
		],
		activePrefixes,
	);
	const interpreters = pythonResults
		.filter((result): result is PythonInterpreter => result !== undefined)
		.filter((result, index, all) => all.findIndex((candidate) => candidate.path === result.path) === index);
	const markers = rootResults.flatMap((result) => result.markers);
	const installedManagers = managerResults.map((result) => result.manager).filter((manager) => manager.installed);
	const declaredManagers = [...new Set(rootResults.flatMap((result) => result.pyprojectManagers))];
	const diagnostics: string[] = [];
	if (interpreters.length === 0) diagnostics.push("No Python interpreter was found on PATH.");
	if (activePrefixes.size === 0) diagnostics.push("No Conda or Python virtual environment is currently activated.");
	for (const manager of declaredManagers) {
		if (!installedManagers.some((installed) => installed.name === manager)) {
			diagnostics.push(`Project declares ${manager}, but ${manager} is not available on PATH.`);
		}
	}
	for (const manager of installedManagers) {
		if (manager.diagnostic) diagnostics.push(`${manager.name}: ${manager.diagnostic}`);
	}

	return {
		schemaVersion: 1,
		detectedAt: new Date().toISOString(),
		host: {
			platform: os,
			architecture: options.arch ?? arch(),
			release: options.release ?? release(),
			homeDirectory: options.homeDirectory ?? homedir(),
			shell: env.SHELL ?? env.ComSpec,
			pathEntries: (env.PATH ?? "").split(delimiter).filter(Boolean),
		},
		process: {
			pid: process.pid,
			nodeVersion: process.version,
			executable: process.execPath,
			cwd: process.cwd(),
		},
		workspace: { sessionDirectory, projectDirectory },
		activation: {
			condaPrefix: env.CONDA_PREFIX,
			condaEnvironment: env.CONDA_DEFAULT_ENV,
			virtualEnvironment: env.VIRTUAL_ENV,
			pyenvVersion: env.PYENV_VERSION,
			poetryActive: env.POETRY_ACTIVE === "1",
			pipenvActive: env.PIPENV_ACTIVE === "1",
		},
		python: interpreters,
		managers: managerResults.map((result) => result.manager),
		environments,
		projectMarkers: markers,
		diagnostics,
		summary: {
			pythonInterpreters: interpreters.length,
			installedManagers: installedManagers.length,
			knownEnvironments: environments.length,
			projectMarkers: markers.length,
			activeEnvironment: environments.find((environment) => environment.active)?.path,
		},
	};
}

function textResult(text: string, details: Record<string, unknown>) {
	return { content: [{ type: "text" as const, text }], details };
}

export function createRuntimeEnvironmentTool(workspace: RuntimeToolWorkspace): AgentTool<typeof environmentSchema> {
	return {
		name: "environment",
		label: "Inspect Environment",
		description:
			"Inspect the local execution environment without changing it. Reports Python interpreters and built-in venv support; active and known conda/mamba/micromamba environments; venv/virtualenv directories; uv, Poetry, Pipenv, pyenv, PDM, Hatch, Pixi, Rye, tox, and nox; project environment files; PATH; and actionable diagnostics. Use before selecting, creating, or activating an environment; do not use bash merely to guess what is installed.",
		parameters: environmentSchema,
		async execute(_id, _params, signal) {
			const report = await inspectRuntimeEnvironment(workspace, {}, signal);
			const summary = report.summary as Record<string, unknown>;
			return textResult(JSON.stringify(report, undefined, 2), {
				readOnly: true,
				summary,
			});
		},
	};
}
