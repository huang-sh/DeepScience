import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { Hono } from "hono";
import { registerSDKRoutes } from "../src/sdk-routes.ts";
import {
	createSession,
	deleteSession,
	getSession,
	initializeSessionStore,
	persistSession,
	resetRuntimeSessions,
} from "../src/session.ts";

function makeTempRoot(): string {
	return mkdtempSync(join(tmpdir(), "ds-history-"));
}

describe("tool result history", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("preserves completed text and image result blocks", async () => {
		const info = await createSession("research");
		try {
			const managed = await getSession(info.id);
			assert.ok(managed);
			managed.agent.state.messages = [
				{
					role: "toolResult",
					toolCallId: "call-1",
					toolName: "plot",
					content: [
						{ type: "text", text: "plot created" },
						{ type: "image", data: "aGVsbG8=", mimeType: "image/png" },
					],
					isError: false,
					timestamp: Date.now(),
				},
			];
			await persistSession(managed);

			const app = new Hono();
			registerSDKRoutes(app);
			const response = await app.request(`/session/${info.id}/message`);
			const body = (await response.json()) as Array<{
				info: { role: string };
				parts: Array<{ type: string; tool: string; content: Array<{ type: string }> }>;
			}>;

			assert.strictEqual(response.status, 200);
			assert.strictEqual(body.length, 1);
			assert.strictEqual(body[0].info.role, "tool");
			assert.strictEqual(body[0].parts[0].tool, "plot");
			assert.deepStrictEqual(
				body[0].parts[0].content.map((block) => block.type),
				["text", "image"],
			);
		} finally {
			await deleteSession(info.id);
		}
	});

	it("preserves Pi thinking blocks and separates process text from the final answer", async () => {
		const info = await createSession("research");
		try {
			const managed = await getSession(info.id);
			assert.ok(managed);
			const usage = {
				input: 1,
				output: 2,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 3,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			};
			managed.agent.state.messages = [
				{
					role: "assistant",
					content: [
						{ type: "thinking", thinking: "evaluate evidence" },
						{ type: "text", text: "I will query the database." },
					],
					api: "anthropic-messages",
					provider: "anthropic",
					model: "claude-sonnet-4-5-20250929",
					usage,
					stopReason: "toolUse",
					timestamp: Date.now(),
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "The final scientific result." }],
					api: "anthropic-messages",
					provider: "anthropic",
					model: "claude-sonnet-4-5-20250929",
					usage,
					stopReason: "stop",
					timestamp: Date.now() + 1,
				},
			];
			await persistSession(managed);

			const app = new Hono();
			registerSDKRoutes(app);
			const response = await app.request(`/session/${info.id}/message`);
			const body = (await response.json()) as Array<{
				info: { role: string; stopReason?: string };
				parts: Array<{ type: string; text: string; phase?: string }>;
			}>;
			assert.strictEqual(body[0].info.stopReason, "toolUse");
			assert.deepStrictEqual(
				body[0].parts.map((part) => [part.type, part.phase]),
				[
					["thinking", undefined],
					["text", "process"],
				],
			);
			assert.strictEqual(body[1].info.stopReason, "stop");
			assert.strictEqual(body[1].parts[0].phase, "final");
		} finally {
			await deleteSession(info.id);
		}
	});
});

describe("history id/time stability", () => {
	beforeEach(() => {
		initializeSessionStore({ rootDir: makeTempRoot() });
	});

	it("returns identical ids and times across repeated reads and restart", async () => {
		const info = await createSession("research");
		const managed = await getSession(info.id);
		assert.ok(managed);
		const now = Date.now();
		managed.agent.state.messages = [
			{
				role: "user",
				content: [{ type: "text", text: "hello" }],
				timestamp: now,
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
				timestamp: now + 1,
			},
		];
		await persistSession(managed);

		const app = new Hono();
		registerSDKRoutes(app);

		const first = await app.request(`/session/${info.id}/message`);
		const firstBody = (await first.json()) as Array<{
			info: { id: string; time: { created: number } };
			parts: Array<{ id: string }>;
		}>;
		assert.strictEqual(firstBody.length, 2);
		assert.strictEqual(firstBody[0].info.time.created, now);
		assert.strictEqual(firstBody[1].info.time.created, now + 1);
		const firstIds = firstBody.map((m) => ({
			id: m.info.id,
			time: m.info.time.created,
			parts: m.parts.map((p) => p.id),
		}));

		const second = await app.request(`/session/${info.id}/message`);
		const secondBody = (await second.json()) as Array<{
			info: { id: string; time: { created: number } };
			parts: Array<{ id: string }>;
		}>;
		const secondIds = secondBody.map((m) => ({
			id: m.info.id,
			time: m.info.time.created,
			parts: m.parts.map((p) => p.id),
		}));
		assert.deepStrictEqual(secondIds, firstIds);

		// Simulate process restart: drop runtime state, keep disk.
		resetRuntimeSessions();
		const rehydrated = await getSession(info.id);
		assert.ok(rehydrated);

		const afterRestart = await app.request(`/session/${info.id}/message`);
		const afterBody = (await afterRestart.json()) as Array<{
			info: { id: string; time: { created: number } };
			parts: Array<{ id: string }>;
		}>;
		const afterIds = afterBody.map((m) => ({
			id: m.info.id,
			time: m.info.time.created,
			parts: m.parts.map((p) => p.id),
		}));
		assert.deepStrictEqual(afterIds, firstIds);
	});
});
