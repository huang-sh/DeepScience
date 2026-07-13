/* ================================================================
   DeepScience server — tool result normalization

   Converts Pi (TextContent | ImageContent) blocks into a frontend-safe
   ToolResultContent[] array for SSE and history payloads.

   Goals:
   - preserve images as base64 data URLs with an explicit MIME type
   - bound per-block and aggregate payload size
   - emit honest text notices when something is omitted or truncated
   - never log raw base64
   ================================================================ */

export interface TextContentBlock {
	type: "text";
	text: string;
}

export interface ImageContentBlock {
	type: "image";
	/** base64-encoded image bytes (no data: prefix) */
	data: string;
	mimeType: string;
}

export type ToolResultContent = TextContentBlock | ImageContentBlock;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const BLOCK_TEXT_LIMIT = 8 * 1024; // 8 KiB per text block
const BLOCK_IMAGE_LIMIT = 2 * 1024 * 1024; // 2 MiB per image block
const AGGREGATE_TEXT_LIMIT = 32 * 1024; // 32 KiB of text across all blocks
const AGGREGATE_IMAGE_LIMIT = 4 * 1024 * 1024; // 4 MiB of image bytes across all blocks

interface ContentLimits {
	blockTextLimit: number;
	blockImageLimit: number;
	aggregateTextLimit: number;
	aggregateImageLimit: number;
}

const DEFAULT_LIMITS: ContentLimits = {
	blockTextLimit: BLOCK_TEXT_LIMIT,
	blockImageLimit: BLOCK_IMAGE_LIMIT,
	aggregateTextLimit: AGGREGATE_TEXT_LIMIT,
	aggregateImageLimit: AGGREGATE_IMAGE_LIMIT,
};

interface RawBlock {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
}

/**
 * Normalize Pi result content into bounded ToolResultContent blocks.
 *
 * The returned array may include honest text notices when blocks are
 * truncated (text) or omitted (unsupported MIME, oversized image, SVG, etc.).
 *
 * @param content - raw Pi content blocks from event.result?.content or a toolResult message
 * @param limits - optional overrides for size limits
 */
export function normalizeToolResultContent(content: unknown, limits: Partial<ContentLimits> = {}): ToolResultContent[] {
	const blocks = Array.isArray(content) ? (content as RawBlock[]) : [];
	if (blocks.length === 0) return [];

	const opts = { ...DEFAULT_LIMITS, ...limits };
	const out: ToolResultContent[] = [];
	let textUsed = 0;
	let imageUsed = 0;

	for (const block of blocks) {
		if (!block || typeof block !== "object") continue;

		if (block.type === "text") {
			const rawText = typeof block.text === "string" ? block.text : "";
			if (rawText.length === 0) continue;

			const remaining = Math.max(0, opts.aggregateTextLimit - textUsed);
			const limit = Math.min(opts.blockTextLimit, remaining);

			if (limit <= 0) {
				out.push({ type: "text", text: "[additional text omitted: aggregate text limit reached]" });
				break;
			}

			const truncated = rawText.length > limit;
			const text = truncated ? rawText.slice(0, limit) : rawText;
			textUsed += text.length;
			out.push({ type: "text", text });

			if (truncated) {
				const omitted = rawText.length - limit;
				out.push({ type: "text", text: `[${omitted} characters truncated]` });
			}
			continue;
		}

		if (block.type === "image") {
			const rawMimeType = typeof block.mimeType === "string" ? block.mimeType.toLowerCase() : "";
			const mimeType = rawMimeType === "image/jpg" ? "image/jpeg" : rawMimeType;
			const data = typeof block.data === "string" ? block.data : "";

			if (mimeType === "image/svg+xml") {
				out.push({ type: "text", text: "[SVG image omitted: inline SVG is not rendered for security]" });
				continue;
			}

			if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
				out.push({
					type: "text",
					text: `[image omitted: unsupported MIME type "${mimeType}"]`,
				});
				continue;
			}
			if (!isValidBase64(data)) {
				out.push({ type: "text", text: "[image omitted: invalid base64 data]" });
				continue;
			}

			const byteLength = Buffer.from(data, "base64").byteLength;

			if (byteLength > opts.blockImageLimit) {
				out.push({
					type: "text",
					text: `[image omitted: ${formatBytes(byteLength)} exceeds per-image limit of ${formatBytes(opts.blockImageLimit)}]`,
				});
				continue;
			}

			const remaining = Math.max(0, opts.aggregateImageLimit - imageUsed);
			if (byteLength > remaining) {
				out.push({
					type: "text",
					text: `[image omitted: aggregate image limit of ${formatBytes(opts.aggregateImageLimit)} reached]`,
				});
				break;
			}

			imageUsed += byteLength;
			out.push({ type: "image", data, mimeType });
		}

		// Unknown block type — skip silently; no base64 logging.
	}

	return out;
}

function isValidBase64(data: string): boolean {
	if (!data || data.length % 4 !== 0) return false;
	return /^[A-Za-z0-9+/]*={0,2}$/.test(data);
}

/**
 * Build a bounded plain-text summary from normalized content blocks.
 *
 * Used for the legacy `output` field so existing consumers still see a
 * short textual trace, and for the timeline detail string.
 *
 * @param content - normalized blocks
 * @param maxLength - maximum characters for the summary
 */
export function summarizeToolResultContent(content: ToolResultContent[], maxLength = 8000): string {
	const text = content
		.filter((c): c is TextContentBlock => c.type === "text")
		.map((c) => c.text)
		.join("\n")
		.slice(0, maxLength);
	return text;
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}
