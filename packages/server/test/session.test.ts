import assert from "node:assert";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import {
	abortSession,
	createSession,
	deleteSession,
	evictStaleSessions,
	getSession,
	initializeSessionStore,
	isSessionLoaded,
	listSessions,
	persistSession,
	resetRuntimeSessions,
	runSessionPrompt,
	trackUserMessage,
	unloadRuntimeSession,
	updateSessionModel,
	updateSessionThinkingLevel,
} from "../src/session.ts";
import { CURRENT_RECORD_VERSION, SessionStore } from "../src/session-store.ts";

function makeTempRoot(): string {
	return mkdtempSync(join(tmpdir(), "ds-sess-"));
}

describe("session management (unit)", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("getSession returns undefined for unknown id", async () => {
		const found = await getSession("nonexistent");
		assert.strictEqual(found, undefined);
	});

	it("abortSession returns false for unknown id", () => {
		const result = abortSession("nonexistent");
		assert.strictEqual(result, false);
	});

	it("deleteSession returns false for unknown id", async () => {
		const result = await deleteSession("nonexistent");
		assert.strictEqual(result, false);
	});

	it("listSessions returns empty when no sessions exist", async () => {
		const list = await listSessions();
		assert.strictEqual(list.length, 0);
	});

	it("evictStaleSessions handles empty map", () => {
		const removed = evictStaleSessions(0);
		assert.strictEqual(removed, 0);
	});

	it("creates and deletes a real Pi-backed session", async () => {
		const workspace = makeTempRoot();
		const info = await createSession("research", undefined, workspace);
		const managed = await getSession(info.id);
		assert.ok(managed?.agent);
		assert.strictEqual(typeof managed.agent.afterToolCall, "function");
		assert.ok(existsSync(info.directory ?? ""));
		writeFileSync(join(info.directory ?? "", "result.csv"), "gene,score\nTP53,1\n", "utf8");
		assert.strictEqual(await deleteSession(info.id), true);
		assert.ok(existsSync(info.directory ?? ""));
		assert.ok(existsSync(join(info.directory ?? "", "result.csv")));
		assert.strictEqual(await getSession(info.id), undefined);
	});

	it("runs a prompt through the durable session lifecycle", async () => {
		const info = await createSession("research");
		const managed = await getSession(info.id);
		assert.ok(managed);
		managed.agent.prompt = async (message) => {
			const userText = typeof message === "string" ? message : "test task";
			managed.agent.state.messages = [
				...managed.agent.state.messages,
				{ role: "user", content: userText, timestamp: Date.now() },
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "CLI_OK",
							textSignature: JSON.stringify({ v: 1, phase: "final_answer" }),
						},
					],
					api: "anthropic-messages",
					provider: "test",
					model: "test-model",
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "stop",
					timestamp: Date.now(),
				},
			];
		};

		const result = await runSessionPrompt(info.id, "test task");
		assert.equal(result.finalText, "CLI_OK");
		assert.equal(result.stopReason, "stop");
		assert.equal((await listSessions())[0]?.messageCount, 1);
	});

	it("maps structured tool failures to Pi isError", async () => {
		const info = await createSession("research");
		const managed = await getSession(info.id);
		assert.ok(managed?.agent.afterToolCall);
		const result = await managed.agent.afterToolCall(
			{
				assistantMessage: {} as never,
				toolCall: { type: "toolCall", id: "call-resource", name: "resource", arguments: {} },
				args: {},
				result: { content: [{ type: "text", text: "Unknown resource: reactome" }], details: { error: true } },
				isError: false,
				context: { systemPrompt: "", messages: [] },
			},
			undefined,
		);
		assert.strictEqual(result?.isError, true);
	});

	it("evicts a stale Pi-backed session from memory only", async () => {
		const info = await createSession("research");
		const managed = await getSession(info.id);
		assert.ok(managed);
		managed.info.updatedAt = 0;
		assert.strictEqual(evictStaleSessions(1), 1);
		assert.strictEqual(isSessionLoaded(info.id), false);
		// Durable record remains and is still listed.
		const list = await listSessions();
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list[0].id, info.id);
		// Re-hydration works.
		const rehydrated = await getSession(info.id);
		assert.ok(rehydrated);
		assert.strictEqual(rehydrated.info.id, info.id);
	});

	it("persists a versioned record on create", async () => {
		const root = makeTempRoot();
		const workspace = makeTempRoot();
		initializeSessionStore({ rootDir: root });
		const created = await createSession("research", undefined, workspace);
		const record = await new SessionStore({ rootDir: root }).load(created.id);
		assert.ok(record);
		assert.strictEqual(record.version, CURRENT_RECORD_VERSION);
		assert.deepStrictEqual(record.info.id, created.id);
		assert.strictEqual(record.info.agentName, "research");
		assert.strictEqual(record.info.projectDirectory, workspace);
		assert.strictEqual(record.info.directory, join(workspace, ".deepscience", "workspace", created.id));
		assert.ok(existsSync(record.info.directory ?? ""));
		assert.ok(existsSync(join(workspace, ".deepscience", "workspace.json")));
		assert.strictEqual(record.info.worktree, workspace);
		assert.strictEqual(record.info.workspaceKind, "project");
		assert.match(record.info.projectID ?? "", /^project_/);
		assert.deepStrictEqual(record.messages, []);
		assert.deepStrictEqual(record.sidecar, {
			capabilities: {},
			messages: {},
			parts: {},
			messageOrder: [],
			todos: [],
			diffs: [],
			snapshots: [],
		});
	});

	it("isolates multiple sessions below the same user-selected Workspace", async () => {
		const project = makeTempRoot();
		const first = await createSession("research", undefined, project);
		const second = await createSession("research", undefined, project);
		assert.strictEqual(first.projectID, second.projectID);
		assert.strictEqual(first.projectDirectory, project);
		assert.strictEqual(second.projectDirectory, project);
		assert.strictEqual(first.directory, join(project, ".deepscience", "workspace", first.id));
		assert.strictEqual(second.directory, join(project, ".deepscience", "workspace", second.id));
		assert.notStrictEqual(first.directory, second.directory);
		assert.ok(existsSync(first.directory ?? ""));
		assert.ok(existsSync(second.directory ?? ""));
	});

	it("round-trips transcript with user/assistant/tool-result content", async () => {
		const info = await createSession("research");
		const managed = await getSession(info.id);
		assert.ok(managed);

		managed.agent.state.messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "hello" },
					{ type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
				],
				timestamp: 1,
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "hi there" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 2,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 3,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 2,
			},
			{
				role: "toolResult",
				toolCallId: "call-1",
				toolName: "plot",
				content: [
					{ type: "text", text: "plot created" },
					{ type: "image", data: "aGVsbG8=", mimeType: "image/png" },
				],
				isError: false,
				details: { provenance: { sessionId: info.id, tool: "plot" } },
				timestamp: 3,
			},
		];
		await persistSession(managed);
		const userMessageID = managed.sidecar.messageOrder?.[0];
		const imagePart = Object.values(managed.sidecar.parts ?? {}).find(
			(part) => part.messageID === userMessageID && part.type === "image",
		);
		assert.ok(imagePart);
		assert.strictEqual(imagePart.mimeType, "image/png");
		assert.strictEqual(imagePart.imageIndex, 1);
		assert.match(imagePart.sha256 ?? "", /^[a-f0-9]{64}$/);

		resetRuntimeSessions();
		const rehydrated = await getSession(info.id);
		assert.ok(rehydrated);
		const rehydratedImage = (
			rehydrated.agent.state.messages[0] as { content: Array<{ type: string; path?: string }> }
		).content.find((content) => content.type === "image");
		assert.match(rehydratedImage?.path ?? "", /^upload\/session-image-[a-f0-9]{12}\.png$/);
		assert.ok(existsSync(join(rehydrated.info.directory ?? "", rehydratedImage?.path ?? "missing")));
		assert.strictEqual(rehydrated.agent.state.messages.length, 3);
		assert.strictEqual(rehydrated.agent.state.messages[0].role, "user");
		assert.deepStrictEqual(
			(rehydrated.agent.state.messages[0] as { content: Array<{ type: string }> }).content.map(
				(content) => content.type,
			),
			["text", "image"],
		);
		assert.ok(
			Object.values(rehydrated.sidecar.parts ?? {}).some(
				(part) => part.id === imagePart.id && part.type === "image" && part.sha256 === imagePart.sha256,
			),
		);
		assert.strictEqual(rehydrated.agent.state.messages[2].role, "toolResult");
		const toolResult = rehydrated.agent.state.messages[2] as {
			role: "toolResult";
			content: Array<{ type: string }>;
			details: { provenance: { sessionId: string; tool: string } };
		};
		assert.deepStrictEqual(
			toolResult.content.map((c) => c.type),
			["text", "image"],
		);
		assert.strictEqual(toolResult.details.provenance.sessionId, info.id);
	});

	it("survives simulated restart via lazy hydration", async () => {
		const info = await createSession("research");
		await trackUserMessage(info.id, "simulate a restart");
		const before = await getSession(info.id);
		assert.ok(before);

		// Simulate process restart: drop runtime state, keep disk.
		resetRuntimeSessions();
		assert.strictEqual(isSessionLoaded(info.id), false);

		const list = await listSessions();
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list[0].id, info.id);
		assert.strictEqual(list[0].messageCount, 1);
		assert.strictEqual(list[0].preview, "simulate a restart");

		const after = await getSession(info.id);
		assert.ok(after);
		assert.strictEqual(after.info.title, "simulate a restart");
		assert.strictEqual(after.agent.state.messages.length, 0);
	});

	it("explicit delete removes durable record", async () => {
		const info = await createSession("research");
		assert.strictEqual(await deleteSession(info.id), true);
		assert.strictEqual(await getSession(info.id), undefined);
		assert.deepStrictEqual(await listSessions(), []);
	});

	it("model and metadata updates survive reload", async () => {
		const info = await createSession("research");
		await trackUserMessage(info.id, "updated title and count");
		await updateSessionModel(info.id, { provider: "anthropic", id: "claude-haiku-4-5-20251001" });

		resetRuntimeSessions();
		const rehydrated = await getSession(info.id);
		assert.ok(rehydrated);
		assert.strictEqual(rehydrated.info.title, "updated title and count");
		assert.strictEqual(rehydrated.info.messageCount, 1);
		assert.strictEqual(rehydrated.info.preview, "updated title and count");
		assert.strictEqual(rehydrated.info.model.provider, "anthropic");
		assert.strictEqual(rehydrated.info.model.id, "claude-haiku-4-5-20251001");
		assert.strictEqual(rehydrated.agent.state.model.provider, "anthropic");
		assert.strictEqual(rehydrated.agent.state.model.id, "claude-haiku-4-5-20251001");
		assert.match(rehydrated.agent.state.systemPrompt, /Dynamic Skill Discovery/);
		assert.match(rehydrated.agent.state.systemPrompt, /Dynamic Scientific Resource Discovery/);
		assert.match(rehydrated.agent.state.systemPrompt, /Session Workspace/);
	});

	it("persists a Pi thinking level supported by the active model", async () => {
		const info = await createSession("research");
		const expectedDefault = info.model.thinkingLevels?.includes("medium") ? "medium" : "off";
		assert.strictEqual(info.thinkingLevel, expectedDefault);
		const supported = info.model.thinkingLevels ?? ["off"];
		const requested = supported.find((level) => level !== "off");
		if (!requested) return;
		const updated = await updateSessionThinkingLevel(info.id, requested);
		assert.strictEqual(updated?.thinkingLevel, requested);
		resetRuntimeSessions();
		const rehydrated = await getSession(info.id);
		assert.strictEqual(rehydrated?.info.thinkingLevel, requested);
		assert.strictEqual(rehydrated?.agent.state.thinkingLevel, requested);
	});
});

describe("trackUserMessage (unit)", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("does not throw on non-existent session", async () => {
		await assert.doesNotReject(async () => {
			await trackUserMessage("nonexistent", "hello");
		});
	});
});

describe("unloadRuntimeSession (unit)", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("unloads from memory without removing disk state", async () => {
		const info = await createSession("research");
		assert.strictEqual(unloadRuntimeSession(info.id), true);
		assert.strictEqual(isSessionLoaded(info.id), false);
		const list = await listSessions();
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list[0].id, info.id);
	});
});
