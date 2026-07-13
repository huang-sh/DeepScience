import assert from "node:assert";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import {
	browseWorkspaceDirectories,
	createGitWorktree,
	createSessionWorkspace,
	listGitWorktrees,
	listWorkspaceProjects,
	openSessionWorkspace,
	registerWorkspaceInstance,
	removeGitWorktree,
	resolveWorkspaceInstance,
} from "../src/workspace-instance.ts";

const execFileAsync = promisify(execFile);
let root = "";
let dataRoot = "";
let oldDataRoot: string | undefined;

before(async () => {
	root = await mkdtemp(join(tmpdir(), "deepscience-workspace-"));
	dataRoot = await mkdtemp(join(tmpdir(), "deepscience-data-"));
	oldDataRoot = process.env.DEEPSCIENCE_DATA_DIR;
	process.env.DEEPSCIENCE_DATA_DIR = dataRoot;
});

after(async () => {
	if (oldDataRoot === undefined) delete process.env.DEEPSCIENCE_DATA_DIR;
	else process.env.DEEPSCIENCE_DATA_DIR = oldDataRoot;
	await rm(root, { recursive: true, force: true });
	await rm(dataRoot, { recursive: true, force: true });
});

describe("workspace instances", () => {
	it("browses selectable directories without exposing internal workspace folders", async () => {
		await mkdir(join(root, "alpha"));
		await mkdir(join(root, ".deepscience"));
		await writeFile(join(root, "result.txt"), "not a directory");
		const listing = await browseWorkspaceDirectories(root);
		assert.strictEqual(listing.directory, await realpath(root));
		assert.ok(listing.directories.some((entry) => entry.name === "alpha"));
		assert.ok(!listing.directories.some((entry) => entry.name === ".deepscience"));
		assert.ok(!listing.directories.some((entry) => entry.name === "result.txt"));
	});

	it("registers a stable non-Git project", async () => {
		const first = await resolveWorkspaceInstance(root);
		const second = await resolveWorkspaceInstance(root);
		assert.strictEqual(first.projectID, second.projectID);
		assert.strictEqual(first.workspaceKind, "project");
		await Promise.all(Array.from({ length: 8 }, () => registerWorkspaceInstance(first)));
		const projects = await listWorkspaceProjects();
		assert.strictEqual(projects.length, 1);
		assert.strictEqual(projects[0]?.id, first.projectID);
		assert.deepStrictEqual(projects[0]?.directories, [first.directory]);
		const localMetadata = JSON.parse(await readFile(join(root, ".deepscience", "workspace.json"), "utf8")) as {
			projectID: string;
			directory: string;
		};
		assert.strictEqual(localMetadata.projectID, first.projectID);
		assert.strictEqual(localMetadata.directory, first.directory);
		const globalRegistry = JSON.parse(await readFile(join(dataRoot, "projects", "index.json"), "utf8")) as {
			version: number;
			projects: unknown[];
		};
		assert.strictEqual(globalRegistry.version, 2);
		assert.strictEqual(globalRegistry.projects.length, 1);
	});

	it("removes missing and managed temporary directories from recent workspaces", async () => {
		const missing = join(root, "removed-project");
		await mkdir(missing);
		await registerWorkspaceInstance(await resolveWorkspaceInstance(missing));
		await rm(missing, { recursive: true, force: true });

		const temporary = await mkdtemp(join(tmpdir(), "ds-sess-"));
		await registerWorkspaceInstance(await resolveWorkspaceInstance(temporary));
		const projects = await listWorkspaceProjects();
		assert.ok(projects.every((project) => !project.directories.includes(missing)));
		assert.ok(projects.every((project) => !project.directories.includes(temporary)));
		await rm(temporary, { recursive: true, force: true });
	});

	it("groups linked Git worktrees under one project and removes managed instances", async () => {
		const repository = join(root, "repository");
		await execFileAsync("git", ["init", repository]);
		await execFileAsync("git", ["config", "user.email", "test@deepscience.local"], { cwd: repository });
		await execFileAsync("git", ["config", "user.name", "DeepScience Test"], { cwd: repository });
		await writeFile(join(repository, "README.md"), "fixture\n");
		await execFileAsync("git", ["add", "README.md"], { cwd: repository });
		await execFileAsync("git", ["commit", "-m", "fixture"], { cwd: repository });

		const primary = await resolveWorkspaceInstance(repository);
		const linked = await createGitWorktree({ directory: repository, name: "analysis" });
		assert.strictEqual(linked.projectID, primary.projectID);
		assert.strictEqual(linked.workspaceKind, "git-worktree");
		assert.ok((await listGitWorktrees(repository)).some((item) => item.directory === linked.directory));

		await removeGitWorktree(linked.directory);
		assert.ok(!(await listGitWorktrees(repository)).some((item) => item.directory === linked.directory));
	});

	it("stores and reopens each Session below the selected Workspace local metadata directory", async () => {
		const project = join(root, "session-project");
		await mkdir(project);
		const sessionID = "sess_00000000-0000-4000-8000-000000000001";
		const created = await createSessionWorkspace({ projectDirectory: project, sessionID });
		const bound = join(project, ".deepscience", "workspace", sessionID);
		assert.strictEqual(created.directory, bound);
		await writeFile(join(created.directory, "result.csv"), "gene,score\nTP53,1\n");

		const opened = await openSessionWorkspace({
			projectDirectory: project,
			sessionID,
		});
		assert.strictEqual(opened.directory, bound);
		assert.strictEqual(await readFile(join(opened.directory, "result.csv"), "utf8"), "gene,score\nTP53,1\n");
		assert.strictEqual(
			JSON.parse(await readFile(join(project, ".deepscience", "workspace.json"), "utf8")).directory,
			project,
		);
	});
});
