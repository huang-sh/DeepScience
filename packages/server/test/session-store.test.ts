import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	CURRENT_RECORD_VERSION,
	isValidSessionId,
	type SessionInfo,
	SessionStore,
	type StoredSessionRecord,
} from "../src/session-store.ts";

function tmpRoot(): string {
	return mkdtempSync(join(tmpdir(), "ds-store-"));
}

function sampleRecord(id: string): StoredSessionRecord {
	const info: SessionInfo = {
		id,
		agentName: "research",
		model: { provider: "zai", id: "glm-5.2", name: "GLM-5.2" },
		title: "sample",
		createdAt: 1,
		updatedAt: 2,
		messageCount: 3,
		preview: "preview",
	};
	return {
		version: CURRENT_RECORD_VERSION,
		info,
		messages: [
			{
				role: "user",
				content: [{ type: "text", text: "hello" }],
				timestamp: 1,
			},
		],
		sidecar: {},
	};
}

describe("SessionStore", () => {
	it("creates a versioned record", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		const record = sampleRecord("sess_1");
		await store.create(record);

		const loaded = await store.load("sess_1");
		assert.ok(loaded);
		assert.strictEqual(loaded.version, CURRENT_RECORD_VERSION);
		assert.strictEqual(loaded.info.id, "sess_1");
		assert.deepStrictEqual(loaded.messages, record.messages);
		assert.deepStrictEqual(loaded.sidecar, {});
	});

	it("rejects records from previous schema versions", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		const record = sampleRecord("sess_old");
		record.version = CURRENT_RECORD_VERSION - 1;
		await assert.rejects(() => store.create(record), /unsupported record version/);
	});

	it("round-trips a representative transcript", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		const messages = [
			{
				role: "user" as const,
				content: [{ type: "text" as const, text: "run the analysis" }],
				timestamp: 10,
			},
			{
				role: "assistant" as const,
				content: [
					{ type: "text" as const, text: "working on it" },
					{ type: "thinking" as const, thinking: "..." },
				],
				api: "anthropic-messages" as const,
				provider: "anthropic" as const,
				model: "claude-sonnet-4-5-20250929",
				usage: {
					input: 10,
					output: 5,
					cacheRead: 1,
					cacheWrite: 2,
					totalTokens: 16,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "toolUse" as const,
				timestamp: 20,
			},
			{
				role: "toolResult" as const,
				toolCallId: "call-1",
				toolName: "plot",
				content: [
					{ type: "text" as const, text: "done" },
					{ type: "image" as const, data: "aGVsbG8=", mimeType: "image/png" },
				],
				isError: false,
				details: { foo: "bar" },
				timestamp: 30,
			},
		];
		const record: StoredSessionRecord = {
			version: CURRENT_RECORD_VERSION,
			info: {
				id: "sess_rt",
				agentName: "research",
				model: { provider: "zai", id: "glm-5.2", name: "GLM-5.2" },
				title: "round-trip",
				createdAt: 1,
				updatedAt: 2,
				messageCount: 3,
				preview: "run the analysis",
			},
			messages,
			sidecar: {},
		};
		await store.create(record);
		const loaded = await store.load("sess_rt");
		assert.ok(loaded);
		assert.deepStrictEqual(loaded.messages, messages);
	});

	it("lists persisted sessions after a simulated restart", async () => {
		const root = tmpRoot();
		const storeA = new SessionStore({ rootDir: root });
		await storeA.create(sampleRecord("sess_a"));
		await storeA.create(sampleRecord("sess_b"));

		const storeB = new SessionStore({ rootDir: root });
		const list = await storeB.list();
		assert.strictEqual(list.length, 2);
		assert.ok(list.some((s) => s.id === "sess_a"));
		assert.ok(list.some((s) => s.id === "sess_b"));
	});

	it("eviction (unloaded store) keeps listing/disk data", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		await store.create(sampleRecord("sess_keep"));
		const list = await store.list();
		assert.strictEqual(list.length, 1);
		const loaded = await store.load("sess_keep");
		assert.ok(loaded);
	});

	it("delete removes the durable record recursively", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		await store.create(sampleRecord("sess_delete"));
		assert.strictEqual(await store.delete("sess_delete"), true);
		assert.strictEqual(await store.load("sess_delete"), undefined);
		assert.deepStrictEqual(await store.list(), []);
	});

	it("ignores a corrupt record and keeps valid sessions", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		await store.create(sampleRecord("sess_good"));
		await mkdir(join(root, "sessions", "sess_bad"), { recursive: true });
		await writeFile(join(root, "sessions", "sess_bad", "session.json"), "{not json", "utf-8");

		const warnings: string[] = [];
		const originalWarn = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(" "));
		};
		try {
			const list = await store.list();
			assert.strictEqual(list.length, 1);
			assert.strictEqual(list[0].id, "sess_good");
			assert.ok(warnings.some((w) => w.includes("sess_bad")));
		} finally {
			console.warn = originalWarn;
		}
	});

	it("rejects unsafe session ids", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		const unsafeIds = ["../escape", "sess/../x", "", "a/b", "a\\b", "..", ".", "a b"];
		for (const id of unsafeIds) {
			assert.strictEqual(isValidSessionId(id), false, `expected ${JSON.stringify(id)} to be unsafe`);
			await assert.rejects(async () => store.load(id), /Unsafe session id/);
			await assert.rejects(async () => store.delete(id), /Unsafe session id/);
		}
	});

	it("does not follow symlink session directories", async () => {
		const root = tmpRoot();
		const otherRoot = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		const otherStore = new SessionStore({ rootDir: otherRoot });
		await otherStore.create(sampleRecord("real"));

		await mkdir(join(root, "sessions"), { recursive: true });
		await symlink(join(otherRoot, "sessions", "real"), join(root, "sessions", "symlinked"));

		const list = await store.list();
		assert.strictEqual(list.length, 0);
		await assert.rejects(async () => store.load("symlinked"), /Symlink not followed/);
	});

	it("serialized writes prevent an older snapshot from winning", async () => {
		const root = tmpRoot();
		const store = new SessionStore({ rootDir: root });
		const id = "sess_race";
		await store.create(sampleRecord(id));

		// Slow write with old state; fast write with new state starts while slow is pending.
		const slow = store.write(id, {
			...sampleRecord(id),
			info: { ...sampleRecord(id).info, messageCount: 1, updatedAt: 100 },
		});
		const fast = store.write(id, {
			...sampleRecord(id),
			info: { ...sampleRecord(id).info, messageCount: 5, updatedAt: 500 },
		});

		await Promise.all([slow, fast]);
		const loaded = await store.load(id);
		assert.ok(loaded);
		assert.strictEqual(loaded.info.messageCount, 5);
		assert.strictEqual(loaded.info.updatedAt, 500);
	});
});
