import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Hono } from "hono";
import { registerSDKRoutes } from "../src/sdk-routes.ts";
import { createSession, getSession, initializeSessionStore, resetRuntimeSessions } from "../src/session.ts";

let root = "";
let workspace = "";
let outside = "";
let sessionID = "";
let sessionWorkspace = "";

before(async () => {
	root = await mkdtemp(join(tmpdir(), "deepscience-binding-store-"));
	workspace = await mkdtemp(join(tmpdir(), "deepscience-binding-workspace-"));
	outside = await mkdtemp(join(tmpdir(), "deepscience-binding-outside-"));
	await writeFile(join(workspace, "input.md"), "# Project input\n");
	await writeFile(join(outside, "secret.md"), "outside\n");
	initializeSessionStore({ rootDir: root });
	const session = await createSession("research", undefined, workspace);
	sessionID = session.id;
	sessionWorkspace = session.directory ?? "";
	await writeFile(join(sessionWorkspace, "result.md"), "# Session result\n");
});

after(async () => {
	resetRuntimeSessions();
	await Promise.all([root, workspace, outside].map((path) => rm(path, { recursive: true, force: true })));
});

describe("session workspace routes", () => {
	it("lists the directory bound to the session", async () => {
		const app = new Hono();
		registerSDKRoutes(app);
		const response = await app.request(`/api/workspace/files?session_id=${encodeURIComponent(sessionID)}`);
		const body = (await response.json()) as { workspace: string; entries: Array<{ name: string }> };
		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.workspace, sessionWorkspace);
		assert.ok(body.entries.some((entry) => entry.name === "result.md"));
	});

	it("reads project source through project/ while keeping it read-only", async () => {
		const managed = await getSession(sessionID);
		assert.ok(managed);
		const readTool = managed.agent.state.tools.find((tool) => tool.name === "read");
		const writeTool = managed.agent.state.tools.find((tool) => tool.name === "write");
		assert.ok(readTool);
		assert.ok(writeTool);
		const source = await readTool.execute("read-project", { path: "project/input.md" });
		assert.match(source.content[0]?.type === "text" ? source.content[0].text : "", /Project input/);
		await assert.rejects(
			() => writeTool.execute("write-project", { path: "project/changed.md", content: "forbidden" }),
			/Project source is read-only/,
		);
	});

	it("reads Resource packages through the dedicated read-only root", async () => {
		const managed = await getSession(sessionID);
		assert.ok(managed);
		const readTool = managed.agent.state.tools.find((tool) => tool.name === "read");
		const writeTool = managed.agent.state.tools.find((tool) => tool.name === "write");
		assert.ok(readTool);
		assert.ok(writeTool);
		const resource = await readTool.execute("read-resource", {
			path: "resource/biological-knowledge/SKILL.md",
		});
		assert.match(resource.content[0]?.type === "text" ? resource.content[0].text : "", /Biological Knowledge/);
		await assert.rejects(
			() => writeTool.execute("write-resource", { path: "resource/changed.md", content: "forbidden" }),
			/Resource packages are read-only/,
		);
	});

	it("serves artifacts from the session directory and rejects external paths", async () => {
		const app = new Hono();
		registerSDKRoutes(app);
		const local = await app.request(
			`/api/artifacts/content?path=result.md&session_id=${encodeURIComponent(sessionID)}`,
		);
		assert.strictEqual(local.status, 200);
		assert.match(await local.text(), /Session result/);

		const escaped = await app.request(
			`/api/artifacts/content?path=${encodeURIComponent(join(outside, "secret.md"))}&session_id=${encodeURIComponent(sessionID)}`,
		);
		assert.strictEqual(escaped.status, 403);
	});
});
