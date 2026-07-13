import assert from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { Hono } from "hono";
import { registerSDKRoutes } from "../src/sdk-routes.ts";
import {
	compactSession,
	createChildSession,
	createSession,
	deleteSession,
	forkSession,
	getSession,
	initializeSessionStore,
	listChildSessions,
	persistSession,
	releaseSessionPrompt,
	reserveSessionPrompt,
	resetRuntimeSessions,
	revertSession,
	setSessionDiffs,
	setSessionTodos,
	summarizeSession,
	unrevertSession,
} from "../src/session.ts";

function makeTempRoot(): string {
	return mkdtempSync(join(tmpdir(), "ds-durable-"));
}

function setMessages(
	managed: Awaited<ReturnType<typeof getSession>>,
	messages: unknown[],
): asserts managed is NonNullable<Awaited<ReturnType<typeof getSession>>> {
	assert.ok(managed);
	managed.agent.state.messages = messages as never;
}

describe("children", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("lists children and creates a child session", async () => {
		const parent = await createSession("research");
		const child = await createChildSession(parent.id, "biology");
		assert.ok(child);
		assert.strictEqual(child.parentID, parent.id);
		assert.notStrictEqual(child.directory, parent.directory);
		assert.strictEqual(child.projectDirectory, parent.projectDirectory);

		const children = await listChildSessions(parent.id);
		assert.strictEqual(children.length, 1);
		assert.strictEqual(children[0].id, child.id);
	});

	it("returns empty for a session with no children", async () => {
		const parent = await createSession("research");
		const children = await listChildSessions(parent.id);
		assert.deepStrictEqual(children, []);
	});

	it("deletes child sessions with their parent", async () => {
		const parent = await createSession("research");
		const child = await createChildSession(parent.id);
		assert.ok(child);
		assert.strictEqual(await deleteSession(parent.id), true);
		assert.strictEqual(await getSession(parent.id), undefined);
		assert.strictEqual(await getSession(child.id), undefined);
	});
});

describe("fork", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("clones the whole transcript when no messageID is given", async () => {
		const workspace = makeTempRoot();
		const original = await createSession("research", undefined, workspace);
		const managed = await getSession(original.id);
		writeFileSync(join(original.directory ?? "", "analysis.csv"), "gene,score\nTP53,1\n", "utf8");
		setMessages(managed, [
			{ role: "user", content: [{ type: "text", text: "a" }], timestamp: 1 },
			{
				role: "assistant",
				content: [{ type: "text", text: "b" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 2,
			},
			{ role: "user", content: [{ type: "text", text: "c" }], timestamp: 3 },
		]);
		await persistSession(managed);

		const forked = await forkSession(original.id);
		assert.ok(forked);
		assert.notStrictEqual(forked.id, original.id);
		assert.strictEqual(forked.parentID, original.id);
		assert.ok(forked.forkedFrom);
		assert.strictEqual(forked.forkedFrom?.sessionID, original.id);
		assert.strictEqual(forked.forkedFrom?.messageID, undefined);

		const forkManaged = await getSession(forked.id);
		assert.ok(forkManaged);
		assert.strictEqual(forkManaged.agent.state.messages.length, 3);
		assert.strictEqual(forkManaged.sidecar.messageOrder?.length, 3);
		assert.ok(forkManaged.sidecar.messages);
		assert.ok(forkManaged.sidecar.parts);
		assert.ok(Object.values(forkManaged.sidecar.messages ?? {}).every((message) => message.sessionID === forked.id));
		// All ids should differ from the original.
		assert.notDeepStrictEqual(forkManaged.sidecar.messageOrder, managed.sidecar.messageOrder);
		assert.notStrictEqual(forked.directory, original.directory);
		assert.strictEqual(readFileSync(join(forked.directory ?? "", "analysis.csv"), "utf8"), "gene,score\nTP53,1\n");
	});

	it("clones transcript before the selected message", async () => {
		const original = await createSession("research");
		const managed = await getSession(original.id);
		setMessages(managed, [
			{ role: "user", content: [{ type: "text", text: "a" }], timestamp: 1 },
			{
				role: "assistant",
				content: [{ type: "text", text: "b" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 2,
			},
			{ role: "user", content: [{ type: "text", text: "c" }], timestamp: 3 },
		]);
		await persistSession(managed);
		const cutMsgId = managed.sidecar.messageOrder?.[2];
		assert.ok(cutMsgId);

		const forked = await forkSession(original.id, cutMsgId);
		assert.ok(forked);

		const forkManaged = await getSession(forked.id);
		assert.ok(forkManaged);
		assert.strictEqual(forkManaged.agent.state.messages.length, 2);
	});

	it("returns undefined for unknown session or message", async () => {
		assert.strictEqual(await forkSession("nonexistent"), undefined);
		const s = await createSession("research");
		assert.strictEqual(await forkSession(s.id, "msg_no_such"), undefined);
	});
});

describe("revert / unrevert", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("reverts to a user boundary and survives restart + unrevert", async () => {
		const session = await createSession("research");
		const managed = await getSession(session.id);
		setMessages(managed, [
			{ role: "user", content: [{ type: "text", text: "a" }], timestamp: 1 },
			{
				role: "assistant",
				content: [{ type: "text", text: "b" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 2,
			},
			{ role: "user", content: [{ type: "text", text: "c" }], timestamp: 3 },
			{
				role: "assistant",
				content: [{ type: "text", text: "d" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 4,
			},
		]);
		await persistSession(managed);
		const originalLength = managed.agent.state.messages.length;
		const originalOrder = managed.sidecar.messageOrder?.slice();

		// Revert targeting the second assistant message should walk back to second user message.
		const secondUserId = managed.sidecar.messageOrder?.[2];
		assert.ok(secondUserId);
		const reverted = await revertSession(session.id, secondUserId);
		assert.ok(reverted);
		assert.strictEqual(managed.agent.state.messages.length, 2);
		assert.ok(managed.info.revert);
		await persistSession(managed);

		// Simulate restart.
		resetRuntimeSessions();
		const reloaded = await getSession(session.id);
		assert.ok(reloaded);
		assert.strictEqual(reloaded.agent.state.messages.length, 2);
		assert.deepStrictEqual(reloaded.sidecar.messageOrder, managed.sidecar.messageOrder);

		// Unrevert restores byte-equivalent transcript.
		const unrestored = await unrevertSession(session.id);
		assert.ok(unrestored);
		assert.strictEqual(reloaded.agent.state.messages.length, originalLength);
		assert.deepStrictEqual(reloaded.sidecar.messageOrder, originalOrder);
		assert.strictEqual(reloaded.info.revert, undefined);
	});

	it("unrevert is idempotent when no revert state exists", async () => {
		const session = await createSession("research");
		const info = await unrevertSession(session.id);
		assert.ok(info);
		assert.strictEqual(info.revert, undefined);
	});
});

describe("todo", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("round-trips todos and survives restart", async () => {
		const session = await createSession("research");
		const todos = [
			{ id: "todo_1", content: "first", status: "pending", priority: "high" as const, createdAt: 1, updatedAt: 1 },
			{
				id: "todo_2",
				content: "second",
				status: "in_progress",
				priority: "medium" as const,
				createdAt: 2,
				updatedAt: 2,
			},
		];
		const result = await setSessionTodos(session.id, todos);
		assert.ok(result);
		assert.strictEqual(result.length, 2);

		resetRuntimeSessions();
		const reloaded = await getSession(session.id);
		assert.ok(reloaded);
		assert.deepStrictEqual(
			reloaded.sidecar.todos?.map((t) => t.id),
			["todo_1", "todo_2"],
		);
	});

	it("rejects invalid and duplicate todo ids", async () => {
		const session = await createSession("research");
		await assert.rejects(
			setSessionTodos(session.id, [{ id: "../bad", content: "x", status: "pending", priority: "low" }]),
			/unsafe/,
		);
		await assert.rejects(
			setSessionTodos(session.id, [
				{ id: "todo_1", content: "x", status: "pending", priority: "low" },
				{ id: "todo_1", content: "y", status: "pending", priority: "low" },
			]),
			/duplicate/,
		);
	});

	it("preserves todos and stable message ids when the transcript grows", async () => {
		const session = await createSession("research");
		const managed = await getSession(session.id);
		setMessages(managed, [{ role: "user", content: [{ type: "text", text: "first" }], timestamp: 1 }]);
		await persistSession(managed);
		const firstMessageID = managed.sidecar.messageOrder?.[0];
		assert.ok(firstMessageID);
		await setSessionTodos(session.id, [{ id: "todo_keep", content: "keep me", status: "pending", priority: "high" }]);

		managed.agent.state.messages = [
			...managed.agent.state.messages,
			{ role: "user", content: [{ type: "text", text: "second" }], timestamp: 2 },
		];
		await persistSession(managed);

		assert.strictEqual(managed.sidecar.messageOrder?.[0], firstMessageID);
		assert.deepStrictEqual(
			managed.sidecar.todos?.map((todo) => todo.id),
			["todo_keep"],
		);
	});

	it("rejects mutations while a prompt is reserved", async () => {
		const session = await createSession("research");
		const managed = await getSession(session.id);
		assert.ok(managed);
		assert.ok(reserveSessionPrompt(managed));
		try {
			await assert.rejects(
				setSessionTodos(session.id, [
					{ id: "todo_busy", content: "must not land", status: "pending", priority: "low" },
				]),
				/busy/,
			);
			assert.deepStrictEqual(managed.sidecar.todos, []);
		} finally {
			releaseSessionPrompt(session.id);
		}
	});

	it("does not let an old prompt release a newer reservation", async () => {
		const session = await createSession("research");
		const managed = await getSession(session.id);
		assert.ok(managed);
		const first = reserveSessionPrompt(managed);
		assert.ok(first);
		releaseSessionPrompt(session.id, first);
		const second = reserveSessionPrompt(managed);
		assert.ok(second);
		releaseSessionPrompt(session.id, first);
		assert.strictEqual(reserveSessionPrompt(managed), undefined);
		releaseSessionPrompt(session.id, second);
		assert.ok(reserveSessionPrompt(managed));
		releaseSessionPrompt(session.id);
	});
});

describe("diff", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("round-trips diffs and filters by messageID", async () => {
		const session = await createSession("research");
		const diffs = [
			{ id: "diff_1", file: "a.txt", patch: "+x", additions: 1, deletions: 0, messageID: "msg_1", createdAt: 1 },
			{ id: "diff_2", file: "b.txt", patch: "-y", additions: 0, deletions: 1, messageID: "msg_2", createdAt: 2 },
		];
		const result = await setSessionDiffs(session.id, diffs);
		assert.ok(result);
		assert.strictEqual(result.length, 2);

		const filtered = await setSessionDiffs(session.id, { diffs });
		assert.ok(filtered);
	});

	it("rejects unsafe diff paths", async () => {
		const session = await createSession("research");
		await assert.rejects(
			setSessionDiffs(session.id, [{ id: "diff_1", file: "../etc/passwd", additions: 0, deletions: 0 }]),
			/unsafe/,
		);
	});
});

describe("summary and compaction", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("persists a supplied summary without a provider call", async () => {
		const session = await createSession("research");
		const summary = await summarizeSession(session.id, "We discussed the experiment.");
		assert.ok(summary);
		assert.strictEqual(summary.text, "We discussed the experiment.");

		resetRuntimeSessions();
		const reloaded = await getSession(session.id);
		assert.ok(reloaded);
		assert.strictEqual(reloaded.sidecar.summary?.text, "We discussed the experiment.");
	});

	it("compacts using a supplied summary and retains recent turns", async () => {
		const session = await createSession("research");
		const managed = await getSession(session.id);
		setMessages(managed, [
			{ role: "user", content: [{ type: "text", text: "old question" }], timestamp: 1 },
			{
				role: "assistant",
				content: [{ type: "text", text: "old answer" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 2,
			},
			{ role: "user", content: [{ type: "text", text: "recent question" }], timestamp: 3 },
			{
				role: "assistant",
				content: [{ type: "text", text: "recent answer" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: 4,
			},
		]);
		await persistSession(managed);

		const result = await compactSession(session.id, {
			suppliedSummary: "Summary of earlier work.",
			recentTurnRetention: 1,
		});
		assert.ok(result);
		assert.strictEqual(result.summary.text, "Summary of earlier work.");
		assert.strictEqual(result.info.compaction?.retainedTurns, 1);
		assert.strictEqual(managed.agent.state.messages.length, 3); // compaction summary + retained user + assistant
		assert.ok((managed.sidecar.snapshots?.length ?? 0) > 0);
		const snapshot = managed.sidecar.snapshots?.find(
			(candidate) => candidate.id === managed.info.compaction?.snapshotID,
		);
		assert.ok(snapshot);
		assert.strictEqual(snapshot.messages.length, 4);
		assert.strictEqual(managed.agent.state.messages[0].role, "user");
		assert.match(JSON.stringify(managed.agent.state.messages[0]), /DeepScience compacted context/);

		resetRuntimeSessions();
		const reloaded = await getSession(session.id);
		assert.ok(reloaded);
		assert.strictEqual(reloaded.info.compaction?.summary, "Summary of earlier work.");
		assert.strictEqual(reloaded.agent.state.messages.length, 3);
	});
});

describe("route handlers", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("returns 404 for unknown session ids", async () => {
		const app = new Hono();
		registerSDKRoutes(app);
		const response = await app.request("/session/nonexistent/todo");
		assert.strictEqual(response.status, 404);
	});

	it("returns 400 for invalid session ids", async () => {
		const app = new Hono();
		registerSDKRoutes(app);
		const response = await app.request("/session/bad%20id/todo");
		assert.strictEqual(response.status, 400);
	});

	it("rejects invalid todo payload with 422", async () => {
		const session = await createSession("research");
		const app = new Hono();
		registerSDKRoutes(app);
		const response = await app.request(`/session/${session.id}/todo`, {
			method: "PUT",
			body: JSON.stringify([{ id: "bad/id", content: "x", status: "pending", priority: "low" }]),
			headers: { "content-type": "application/json" },
		});
		assert.strictEqual(response.status, 422);
	});

	it("returns 409 when a fork races an accepted prompt", async () => {
		const session = await createSession("research");
		const managed = await getSession(session.id);
		assert.ok(managed);
		assert.ok(reserveSessionPrompt(managed));
		try {
			const app = new Hono();
			registerSDKRoutes(app);
			const response = await app.request(`/session/${session.id}/fork`, {
				method: "POST",
				body: "{}",
				headers: { "content-type": "application/json" },
			});
			assert.strictEqual(response.status, 409);
		} finally {
			releaseSessionPrompt(session.id);
		}
	});
});
