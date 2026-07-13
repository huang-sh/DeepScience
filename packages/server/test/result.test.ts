/* ================================================================
   DeepScience server — result normalization tests

   Dependency-free tests using Node's built-in test runner.
   ================================================================ */

import assert from "node:assert";
import { describe, it } from "node:test";
import type { ToolResultContent } from "../src/result.ts";
import { normalizeToolResultContent, summarizeToolResultContent } from "../src/result.ts";
import { agentEventToSSE, createAgentEventSSEBridge } from "../src/session.ts";

function b64png(): string {
	// 1x1 transparent PNG
	return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
}

describe("normalizeToolResultContent", () => {
	it("returns empty for empty or invalid input", () => {
		assert.deepStrictEqual(normalizeToolResultContent([]), []);
		assert.deepStrictEqual(normalizeToolResultContent(null as unknown as ToolResultContent[]), []);
		assert.deepStrictEqual(normalizeToolResultContent("bad" as unknown as ToolResultContent[]), []);
	});

	it("passes through text blocks", () => {
		const out = normalizeToolResultContent([{ type: "text", text: "hello" }]);
		assert.deepStrictEqual(out, [{ type: "text", text: "hello" }]);
	});

	it("passes through allowed image blocks", () => {
		const out = normalizeToolResultContent([{ type: "image", data: b64png(), mimeType: "image/png" }]);
		assert.strictEqual(out.length, 1);
		assert.strictEqual(out[0].type, "image");
	});

	it("normalizes image/jpg and rejects invalid base64", () => {
		const normalized = normalizeToolResultContent([{ type: "image", data: b64png(), mimeType: "image/jpg" }]);
		assert.deepStrictEqual(normalized, [{ type: "image", data: b64png(), mimeType: "image/jpeg" }]);

		const invalid = normalizeToolResultContent([{ type: "image", data: "not-base64", mimeType: "image/png" }]);
		assert.strictEqual(invalid[0]?.type, "text");
		assert.match((invalid[0] as { text: string }).text, /invalid base64/);
	});

	it("omits SVG with a text notice", () => {
		const out = normalizeToolResultContent([{ type: "image", data: "PHN2Zz48L3N2Zz4=", mimeType: "image/svg+xml" }]);
		assert.strictEqual(out.length, 1);
		assert.strictEqual(out[0].type, "text");
		assert.ok((out[0] as { text: string }).text.includes("SVG"));
	});

	it("omits unsupported MIME types", () => {
		const out = normalizeToolResultContent([{ type: "image", data: "", mimeType: "image/bmp" }]);
		assert.strictEqual(out.length, 1);
		assert.strictEqual(out[0].type, "text");
	});

	it("omits images that exceed the configured size limit", () => {
		const out = normalizeToolResultContent([{ type: "image", data: b64png(), mimeType: "image/png" }], {
			blockImageLimit: 1,
		});
		assert.strictEqual(out[0]?.type, "text");
		assert.match((out[0] as { text: string }).text, /exceeds per-image limit/);
	});

	it("truncates oversized text blocks", () => {
		const long = "a".repeat(16 * 1024);
		const out = normalizeToolResultContent([{ type: "text", text: long }]);
		assert.strictEqual(out.length, 2);
		assert.ok((out[0] as { text: string }).text.length <= 8 * 1024);
		assert.ok((out[1] as { text: string }).text.includes("truncated"));
	});

	it("honors aggregate text limit", () => {
		const out = normalizeToolResultContent(
			[
				{ type: "text", text: "a".repeat(16 * 1024) },
				{ type: "text", text: "should be omitted" },
			],
			{ aggregateTextLimit: 100 },
		);
		assert.strictEqual(out.length, 3);
		assert.ok((out[2] as { text: string }).text.includes("aggregate text limit"));
	});
});

describe("summarizeToolResultContent", () => {
	it("joins text blocks", () => {
		const out = summarizeToolResultContent([
			{ type: "text", text: "one" },
			{ type: "text", text: "two" },
		]);
		assert.strictEqual(out, "one\ntwo");
	});

	it("bounds summary length", () => {
		const out = summarizeToolResultContent([{ type: "text", text: "a".repeat(10000) }], 100);
		assert.strictEqual(out.length, 100);
	});
});

describe("Pi event to SSE rich result bridge", () => {
	it("preserves Pi turn, thinking, text phase, and terminal semantics", () => {
		const bridge = createAgentEventSSEBridge();
		assert.deepStrictEqual(bridge({ type: "turn_start" } as never), { type: "turn_start", turnIndex: 0 });

		const thinking = bridge({
			type: "message_update",
			assistantMessageEvent: {
				type: "thinking_delta",
				contentIndex: 0,
				delta: "inspect evidence",
				partial: { content: [{ type: "thinking", thinking: "inspect evidence" }] },
			},
		} as never);
		assert.deepStrictEqual(thinking, {
			type: "thinking_delta",
			turnIndex: 0,
			contentIndex: 0,
			delta: "inspect evidence",
			redacted: false,
		});

		const text = bridge({
			type: "message_update",
			assistantMessageEvent: {
				type: "text_delta",
				contentIndex: 1,
				delta: "Working note",
				partial: {
					content: [
						{ type: "thinking", thinking: "inspect evidence" },
						{ type: "text", text: "Working note", textSignature: JSON.stringify({ v: 1, phase: "commentary" }) },
					],
				},
			},
		} as never);
		assert.strictEqual(text?.type, "text_delta");
		assert.strictEqual(text?.phase, "process");

		const ended = bridge({ type: "message_end", message: { role: "assistant", stopReason: "stop" } } as never);
		assert.deepStrictEqual(ended, {
			type: "assistant_end",
			turnIndex: 0,
			stopReason: "stop",
			errorMessage: undefined,
		});
	});

	it("preserves text and PNG content blocks", () => {
		const event = {
			type: "tool_execution_end",
			toolName: "plot",
			toolCallId: "call-1",
			isError: false,
			result: {
				content: [
					{ type: "text", text: "created plot" },
					{ type: "image", data: b64png(), mimeType: "image/png" },
				],
			},
		};
		const sse = agentEventToSSE(event as never);
		assert.ok(sse);
		assert.strictEqual(sse.type, "tool_end");
		assert.deepStrictEqual(sse.content, event.result.content);
		assert.strictEqual(sse.output, "created plot");
	});
});
