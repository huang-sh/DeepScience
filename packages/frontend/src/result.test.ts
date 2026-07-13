/* ================================================================
   DeepScience frontend — result utility tests

   Dependency-free tests using Node's built-in test runner.
   ================================================================ */

import assert from "node:assert";
import { describe, it } from "node:test";
import {
	ALLOWED_IMAGE_MIME_TYPES,
	coerceHistoryContent,
	extractArtifactReferences,
	imageCount,
	imageDataUrl,
	isSafeImageSrc,
	normalizeBlock,
	normalizeContent,
	previewText,
	summarizeContent,
	textBlockCount,
	textualContent,
} from "./result.ts";
import type { ImageContentBlock, TextContentBlock, ToolResultContent } from "./types.ts";

const SAMPLE_JSON = JSON.stringify({ organism: "Homo sapiens", gene: "TP53" });
const SAMPLE_MARKDOWN = "## Results\n\n- item one\n- item two\n";
const SAMPLE_CODE = "```python\nprint('hello')\n```";
const SAMPLE_TEXT = "Tool completed successfully.";

function b64png(): string {
	// 1x1 transparent PNG
	return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
}

describe("imageDataUrl", () => {
	it("builds a safe data URL for allowed PNG", () => {
		const url = imageDataUrl({ type: "image", data: b64png(), mimeType: "image/png" });
		assert.ok(url?.startsWith("data:image/png;base64,"));
		assert.ok(isSafeImageSrc(url));
	});

	it("rejects unsupported SVG", () => {
		const url = imageDataUrl({ type: "image", data: "PHN2Zz48L3N2Zz4=", mimeType: "image/svg+xml" });
		assert.strictEqual(url, null);
	});

	it("rejects empty data", () => {
		const url = imageDataUrl({ type: "image", data: "", mimeType: "image/png" });
		assert.strictEqual(url, null);
	});

	it("normalizes MIME to lowercase via allowed set", () => {
		assert.ok(ALLOWED_IMAGE_MIME_TYPES.has("image/png"));
		assert.ok(!ALLOWED_IMAGE_MIME_TYPES.has("image/svg+xml"));
	});

	it("normalizes the non-standard image/jpg alias", () => {
		const url = imageDataUrl({ type: "image", data: b64png(), mimeType: "image/jpg" });
		assert.ok(url?.startsWith("data:image/jpeg;base64,"));
	});
});

describe("normalizeBlock", () => {
	it("detects JSON", () => {
		const block: TextContentBlock = { type: "text", text: SAMPLE_JSON };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.kind, "text");
		assert.strictEqual(normalized.variant, "json");
		assert.ok(normalized.pretty?.includes("TP53"));
	});

	it("detects fenced code", () => {
		const block: TextContentBlock = { type: "text", text: SAMPLE_CODE };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.kind, "text");
		assert.strictEqual(normalized.variant, "code");
		assert.strictEqual(normalized.language, "python");
		assert.strictEqual(normalized.code, "print('hello')");
	});

	it("detects Markdown", () => {
		const block: TextContentBlock = { type: "text", text: SAMPLE_MARKDOWN };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.kind, "text");
		assert.strictEqual(normalized.variant, "markdown");
	});

	it("falls back to plain text", () => {
		const block: TextContentBlock = { type: "text", text: SAMPLE_TEXT };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.kind, "text");
		assert.strictEqual(normalized.variant, "text");
	});

	it("flags truncation notices", () => {
		const block: TextContentBlock = { type: "text", text: "[123 characters truncated]" };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.isNotice, true);
	});

	it("normalizes safe image blocks", () => {
		const block: ImageContentBlock = { type: "image", data: b64png(), mimeType: "image/png" };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.kind, "image");
		assert.strictEqual(normalized.mimeType, "image/png");
		assert.ok((normalized as { src: string }).src.startsWith("data:image/png;base64,"));
	});

	it("marks SVG as unsafe", () => {
		const block: ImageContentBlock = { type: "image", data: "PHN2Zz48L3N2Zz4=", mimeType: "image/svg+xml" };
		const normalized = normalizeBlock(block);
		assert.strictEqual(normalized.kind, "unsafe-image");
	});
});

describe("extractArtifactReferences", () => {
	it("finds local images and code/data files", () => {
		const refs = extractArtifactReferences("Saved plot to outputs/figure.png and code to ./analysis.py");
		assert.deepStrictEqual(
			refs.map((ref) => [ref.kind, ref.path]),
			[
				["image", "outputs/figure.png"],
				["file", "./analysis.py"],
			],
		);
		assert.match(refs[0].src, /^\/api\/artifacts\/content\?path=/);
	});

	it("supports absolute in-workspace candidates but ignores traversal and URLs", () => {
		const refs = extractArtifactReferences(
			"/data20T/dev/DeepScience/DeepScience/results/plot.webp ../secret.png https://example.com/remote.png",
		);
		assert.strictEqual(refs.length, 1);
		assert.strictEqual(refs[0].kind, "image");
	});
});

describe("normalizeContent", () => {
	it("handles null/undefined as empty", () => {
		assert.deepStrictEqual(normalizeContent(null), []);
		assert.deepStrictEqual(normalizeContent(undefined), []);
		assert.deepStrictEqual(normalizeContent("bad" as unknown as ToolResultContent[]), []);
	});

	it("normalizes mixed blocks", () => {
		const content: ToolResultContent[] = [
			{ type: "text", text: SAMPLE_JSON },
			{ type: "image", data: b64png(), mimeType: "image/png" },
		];
		const blocks = normalizeContent(content);
		assert.strictEqual(blocks.length, 2);
		assert.strictEqual(blocks[0].kind, "text");
		assert.strictEqual(blocks[1].kind, "image");
	});
});

describe("summarizeContent / previewText", () => {
	it("joins text blocks", () => {
		const content: ToolResultContent[] = [
			{ type: "text", text: "line one" },
			{ type: "text", text: "line two" },
		];
		assert.strictEqual(summarizeContent(content), "line one\nline two");
	});

	it("falls back to output for preview", () => {
		assert.strictEqual(previewText([], "fallback"), "fallback");
	});

	it("truncates long previews", () => {
		const long = "a".repeat(500);
		assert.strictEqual(previewText([{ type: "text", text: long }]).length, 241);
		assert.ok(previewText([{ type: "text", text: long }]).endsWith("…"));
	});
});

describe("coerceHistoryContent", () => {
	it("coerces text and image blocks from history", () => {
		const raw = [
			{ type: "text", text: "hello" },
			{ type: "image", data: b64png(), mimeType: "image/png" },
			{ type: "unknown", value: 1 },
		];
		const content = coerceHistoryContent(raw);
		assert.strictEqual(content.length, 2);
		assert.strictEqual(content[0].type, "text");
		assert.strictEqual(content[1].type, "image");
	});

	it("returns empty for non-array", () => {
		assert.deepStrictEqual(coerceHistoryContent({ type: "text" }), []);
	});
});

describe("counters", () => {
	it("counts images and text blocks", () => {
		const content: ToolResultContent[] = [
			{ type: "image", data: "", mimeType: "image/png" },
			{ type: "image", data: "", mimeType: "image/png" },
			{ type: "text", text: "x" },
		];
		assert.strictEqual(imageCount(content), 2);
		assert.strictEqual(textBlockCount(content), 1);
	});
});

describe("textualContent", () => {
	it("prefers pretty JSON", () => {
		const blocks = normalizeContent([{ type: "text", text: SAMPLE_JSON }]);
		const text = textualContent(blocks);
		assert.ok(text.includes("TP53"));
		assert.ok(text.includes("\n"));
	});
});
