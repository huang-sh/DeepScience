/* ================================================================
   DeepScience frontend — tool result parsing/normalization utilities

   Pure, dependency-free helpers for turning server ToolResultContent
   blocks into renderable previews. Never logs raw base64.
   ================================================================ */

import type { ImageContentBlock, TextContentBlock, ToolResultContent } from "./types";

export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const SAFE_IMAGE_SRC_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;

export interface ParsedTextBlock {
	kind: "text";
	variant: "json" | "code" | "markdown" | "text";
	/** Original/raw text. */
	text: string;
	/** Pretty-printed JSON when variant === "json". */
	pretty?: string;
	/** Fence-free source when variant === "code". */
	code?: string;
	/** Detected language label for fenced code blocks. */
	language?: string;
	/** Whether the text looks like an error/truncation notice. */
	isNotice: boolean;
}

export interface SafeImageBlock {
	kind: "image";
	mimeType: string;
	data: string;
	/** Frontend-safe data URL. */
	src: string;
	alt: string;
}

export interface UnsafeImageBlock {
	kind: "unsafe-image";
	mimeType: string;
	reason: string;
	alt: string;
}

export type NormalizedBlock = ParsedTextBlock | SafeImageBlock | UnsafeImageBlock;

export interface ArtifactReference {
	kind: "image" | "file";
	path: string;
	label: string;
	src: string;
}

const ARTIFACT_EXTENSION =
	/\.(png|jpe?g|gif|webp|txt|md|markdown|html?|json|csv|tsv|py|r|js|mjs|cjs|ts|tsx|jsx|sh|bash|zsh|fish|ya?ml|toml|xml|css|sql)$/i;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp)$/i;

/**
 * Build a data URL from an image content block.
 * Returns null if the MIME type or data is unsafe/empty.
 */
export function imageDataUrl(block: ImageContentBlock): string | null {
	const rawMimeType = block.mimeType?.toLowerCase() ?? "";
	const mimeType = rawMimeType === "image/jpg" ? "image/jpeg" : rawMimeType;
	if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return null;
	const data = (block.data ?? "").replace(/\s/g, "");
	if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return null;
	return `data:${mimeType};base64,${data}`;
}

export function artifactContentUrl(path: string, sessionId?: string): string {
	const query = new URLSearchParams({ path });
	if (sessionId) query.set("session_id", sessionId);
	return `/api/artifacts/content?${query.toString()}`;
}

/** Extract explicit Markdown references and obvious standalone output paths. */
export function extractArtifactReferences(text: string, sessionId?: string): ArtifactReference[] {
	const references = new Map<string, ArtifactReference>();
	const add = (candidate: string, label?: string) => {
		const path = candidate.trim().replace(/^['"`]|['"`]$/g, "");
		if (!path || /^(?:https?:|data:|javascript:|#)/i.test(path) || path.includes("..") || path.includes("~")) return;
		if (!ARTIFACT_EXTENSION.test(path)) return;
		const filename = path.split(/[\\/]/).pop() || path;
		references.set(path, {
			kind: IMAGE_EXTENSION.test(path) ? "image" : "file",
			path,
			label: label?.trim() || filename,
			src: artifactContentUrl(path, sessionId),
		});
	};

	for (const match of text.matchAll(/!?\[([^\]]*)\]\(([^)\s]+)\)/g)) add(match[2], match[1]);
	for (const match of text.matchAll(
		/(?:^|[\s'"`(])((?:\.?\/?|\/)(?:[\w.-]+\/)*[\w.-]+\.(?:png|jpe?g|gif|webp|txt|md|markdown|html?|json|csv|tsv|py|r|js|mjs|cjs|ts|tsx|jsx|sh|bash|zsh|fish|ya?ml|toml|xml|css|sql))(?=$|[\s'"`),;:])/gim,
	)) {
		add(match[1]);
	}

	return [...references.values()];
}

export function isSafeImageSrc(src: string): boolean {
	return SAFE_IMAGE_SRC_PATTERN.test(src);
}

function isJson(text: string): boolean {
	const trimmed = text.trim();
	if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false;
	try {
		JSON.parse(trimmed);
		return true;
	} catch {
		return false;
	}
}

function isFencedCode(text: string): { yes: true; language: string; body: string } | { yes: false } {
	const match = text.match(/^```(\w*)\n?([\s\S]*?)```$/);
	if (!match) return { yes: false };
	return { yes: true, language: match[1] || "text", body: match[2].replace(/\n$/, "") };
}

function looksLikeMarkdown(text: string): boolean {
	const checks = [
		/^#{1,6}\s+/m,
		/\*\*.+?\*\*/,
		/`[^`]+`/,
		/^\s*[-*]\s+/m,
		/^\s*\d+\.\s+/m,
		/\[.+?\]\(https?:\/\/.+?\)/,
		/^\s*\|.+\|/m,
		/^\s*>\s/m,
		/^---+/m,
	];
	return checks.some((re) => re.test(text));
}

function isNotice(text: string): boolean {
	return /^\[.+?\]|\[\d+ characters truncated\]|\[additional .+ omitted\]/.test(text.trim());
}

/**
 * Normalize a single ToolResultContent block into a renderable form.
 */
export function normalizeBlock(block: ToolResultContent): NormalizedBlock {
	if (block.type === "image") {
		const rawMimeType = block.mimeType?.toLowerCase() ?? "";
		const mimeType = rawMimeType === "image/jpg" ? "image/jpeg" : rawMimeType;
		const alt = `Tool result image (${mimeType || "unknown"})`;
		if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
			return { kind: "unsafe-image", mimeType, reason: "Unsupported MIME type", alt };
		}
		const src = imageDataUrl(block);
		if (!src) {
			return { kind: "unsafe-image", mimeType, reason: "Invalid base64 image data", alt };
		}
		return { kind: "image", mimeType, data: block.data, src, alt };
	}

	const text = block.text ?? "";
	const trimmed = text.trim();

	if (isJson(trimmed)) {
		return {
			kind: "text",
			variant: "json",
			text,
			pretty: JSON.stringify(JSON.parse(trimmed), null, 2),
			isNotice: isNotice(text),
		};
	}

	const fenced = isFencedCode(trimmed);
	if (fenced.yes) {
		return {
			kind: "text",
			variant: "code",
			text,
			language: fenced.language,
			code: fenced.body,
			isNotice: isNotice(text),
		};
	}

	if (looksLikeMarkdown(text)) {
		return { kind: "text", variant: "markdown", text, isNotice: isNotice(text) };
	}

	return { kind: "text", variant: "text", text, isNotice: isNotice(text) };
}

/**
 * Normalize an array of ToolResultContent blocks.
 */
export function normalizeContent(content: ToolResultContent[] | undefined | null): NormalizedBlock[] {
	if (!Array.isArray(content)) return [];
	return content.map(normalizeBlock);
}

/**
 * Build a bounded plain-text summary from content blocks.
 * Mirrors server summarizeToolResultContent for consistency.
 */
export function summarizeContent(content: ToolResultContent[] | undefined | null, maxLength = 8000): string {
	if (!Array.isArray(content)) return "";
	const text = content
		.filter((c): c is TextContentBlock => c.type === "text")
		.map((c) => c.text)
		.join("\n")
		.slice(0, maxLength);
	return text;
}

/**
 * Extract copyable textual content from normalized blocks.
 */
export function textualContent(blocks: NormalizedBlock[]): string {
	return blocks
		.filter((b): b is ParsedTextBlock => b.kind === "text")
		.map((b) => (b.variant === "json" && b.pretty ? b.pretty : b.text))
		.join("\n\n");
}

/**
 * Build a short inline preview string from content blocks.
 * Falls back to output when no rich content is present.
 */
export function previewText(content: ToolResultContent[] | undefined | null, output?: string, maxChars = 240): string {
	const summary = summarizeContent(content, maxChars * 2) || output || "";
	if (summary.length <= maxChars) return summary;
	return `${summary.slice(0, maxChars)}…`;
}

/**
 * Coerce an unknown history part content value into ToolResultContent blocks.
 */
export function coerceHistoryContent(raw: unknown): ToolResultContent[] {
	if (!raw) return [];
	if (Array.isArray(raw)) {
		return raw
			.map((item: unknown): ToolResultContent | null => {
				if (!item || typeof item !== "object") return null;
				const obj = item as Record<string, unknown>;
				if (obj.type === "text" && typeof obj.text === "string") {
					return { type: "text", text: obj.text };
				}
				if (obj.type === "image" && typeof obj.data === "string" && typeof obj.mimeType === "string") {
					return { type: "image", data: obj.data, mimeType: obj.mimeType };
				}
				return null;
			})
			.filter((b): b is ToolResultContent => b !== null);
	}
	return [];
}

/**
 * Count how many images are present in content blocks.
 */
export function imageCount(content: ToolResultContent[] | undefined | null): number {
	if (!Array.isArray(content)) return 0;
	return content.filter((c) => c.type === "image").length;
}

/**
 * Count how many text blocks are present in content blocks.
 */
export function textBlockCount(content: ToolResultContent[] | undefined | null): number {
	if (!Array.isArray(content)) return 0;
	return content.filter((c) => c.type === "text").length;
}
