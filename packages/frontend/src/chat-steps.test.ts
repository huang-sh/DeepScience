import assert from "node:assert";
import { describe, it } from "node:test";
import { groupMessageParts, toolStatusLabel } from "./components/ChatPanel.tsx";
import type { MessagePart } from "./types";

describe("chat execution step grouping", () => {
	it("groups consecutive tool calls while keeping response text outside", () => {
		const parts: MessagePart[] = [
			{ kind: "text", text: "I will inspect the data." },
			{ kind: "tool", id: "read-1", tool: "read", status: "done" },
			{ kind: "tool", id: "bash-1", tool: "bash", status: "running" },
			{ kind: "text", text: "The analysis is ready." },
		];
		const groups = groupMessageParts(parts);
		assert.strictEqual(groups.length, 3);
		assert.strictEqual(groups[0]?.kind, "part");
		assert.strictEqual(groups[1]?.kind, "steps");
		if (groups[1]?.kind === "steps")
			assert.deepStrictEqual(
				groups[1].parts.map((part) => part.tool),
				["read", "bash"],
			);
		assert.strictEqual(groups[2]?.kind, "part");
	});

	it("keeps Pi reasoning and commentary in steps and final text outside", () => {
		const parts: MessagePart[] = [
			{ kind: "thinking", id: "thinking-1", text: "evaluate evidence", turnIndex: 0 },
			{ kind: "text", id: "commentary-1", text: "I will query the resource.", phase: "process", turnIndex: 0 },
			{ kind: "tool", id: "resource-1", tool: "resource", status: "done", turnIndex: 0 },
			{ kind: "text", id: "final-1", text: "The final result.", phase: "final", turnIndex: 1 },
		];
		const groups = groupMessageParts(parts);
		assert.strictEqual(groups.length, 2);
		assert.strictEqual(groups[0]?.kind, "steps");
		if (groups[0]?.kind === "steps") assert.strictEqual(groups[0].parts.length, 3);
		assert.strictEqual(groups[1]?.kind, "part");
	});

	it("distinguishes catalog browsing, loading, and failure", () => {
		assert.strictEqual(
			toolStatusLabel({ kind: "tool", id: "list", tool: "resource", args: { action: "list" }, status: "done" }),
			"browsed",
		);
		assert.strictEqual(
			toolStatusLabel({ kind: "tool", id: "read", tool: "resource", args: { action: "read" }, status: "done" }),
			"loaded",
		);
		assert.strictEqual(
			toolStatusLabel({
				kind: "tool",
				id: "history-read",
				tool: "resource",
				details: { loaded: true },
				status: "done",
			}),
			"loaded",
		);
		assert.strictEqual(
			toolStatusLabel({ kind: "tool", id: "error", tool: "resource", args: { action: "read" }, status: "error" }),
			"error",
		);
	});
});
