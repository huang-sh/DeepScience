/* ================================================================
   DeepScience frontend — reusable tool result renderer

   Renders ToolResultContent blocks as JSON, fenced code, Markdown/text,
   or safe image thumbnails. Provides bounded inline previews with an
   "Open result" path to the full Artifact panel.
   ================================================================ */

import { For, Show, Switch, Match, createSignal } from "solid-js"
import Markdown, { renderDelimitedTable } from "./Markdown"
import type { ToolResultContent } from "../types"
import type { ToolStatus } from "../types"
import {
	coerceHistoryContent,
	extractArtifactReferences,
	normalizeContent,
	textualContent,
	type ArtifactReference,
	type NormalizedBlock,
} from "../result"

export interface ResultRendererProps {
	/** Rich content blocks from the server. */
	content?: ToolResultContent[] | null;
	/** Legacy plain-text summary (fallback when content is empty). */
	output?: string | null;
	status?: ToolStatus;
	/** If true, render a compact inline preview instead of the full payload. */
	preview?: boolean;
	/** Called when the user asks to open the full result. */
	onOpen?: () => void;
	/** Optional accessible label for the result region. */
	ariaLabel?: string;
	/** Preview a referenced workspace file in the containing artifact layer. */
	onOpenFile?: (path: string) => void;
	/** Session whose workspace owns referenced file paths. */
	sessionId?: string;
}

const PREVIEW_MAX_CHARS = 220;

export default function ResultRenderer(props: ResultRendererProps) {
	const content = () => coerceHistoryContent(props.content);
	const blocks = () => normalizeContent(content());
	const hasContent = () => blocks().length > 0;
	const hasOutput = () => !!(props.output ?? "").trim();

	return (
		<div
			class={`result-renderer ${props.status === "error" ? "result-renderer--error" : ""}`}
			role="region"
			aria-label={props.ariaLabel || "Tool result"}
		>
			<Show
				when={hasContent()}
				fallback={
					<Show when={hasOutput()}>
						<TextOnly text={props.output!} status={props.status} onOpenFile={props.onOpenFile} sessionId={props.sessionId} />
					</Show>
				}
			>
				<Show
					when={!props.preview}
					fallback={
						<ResultPreview
							blocks={blocks()}
							output={props.output ?? ""}
							onOpen={props.onOpen}
							status={props.status}
							sessionId={props.sessionId}
						/>
					}
				>
					<ResultFull blocks={blocks()} status={props.status} onOpenFile={props.onOpenFile} sessionId={props.sessionId} />
				</Show>
			</Show>
		</div>
	);
}

function ResultPreview(props: {
	blocks: NormalizedBlock[];
	output: string;
	onOpen?: () => void;
	status?: ToolStatus;
	sessionId?: string;
}) {
	const previewBlocks = () => {
		// Show at most one image thumbnail and one text preview.
		const images = props.blocks.filter((b) => b.kind === "image").slice(0, 1);
		const texts = props.blocks.filter((b) => b.kind === "text").slice(0, 2);
		return { images, texts };
	};
	const references = () =>
		props.blocks
			.filter((block): block is Extract<NormalizedBlock, { kind: "text" }> => block.kind === "text")
			.flatMap((block) => extractArtifactReferences(block.text, props.sessionId));

	const textPreview = () => {
		const raw = props.blocks
			.filter((b): b is Extract<NormalizedBlock, { kind: "text" }> => b.kind === "text")
			.map((b) => (b.variant === "json" && b.pretty ? b.pretty : b.text))
			.join("\n")
			.slice(0, PREVIEW_MAX_CHARS);
		return raw || props.output.slice(0, PREVIEW_MAX_CHARS);
	};

	const hasMore = () =>
		props.blocks.filter((block) => block.kind === "image").length > 1 ||
		props.blocks.filter((block) => block.kind === "text").length > 2 ||
		references().length > 0 ||
		textPreview().length >= PREVIEW_MAX_CHARS;

	return (
		<div class="result-preview">
			<Show when={previewBlocks().images.length > 0}>
				<div class="result-preview__gallery">
					<For each={previewBlocks().images}>
						{(block) => <ImageThumbnail block={block} onClick={props.onOpen} />}
					</For>
				</div>
			</Show>

			<Show when={references().some((reference) => reference.kind === "image")}>
				<div class="result-preview__gallery">
					<For each={references().filter((reference) => reference.kind === "image").slice(0, 2)}>
						{(reference) => <ReferencedImage reference={reference} />}
					</For>
				</div>
			</Show>

			<Show when={textPreview().trim()}>
				<div class="result-preview__text">
					<TextOnly text={textPreview()} status={props.status} sessionId={props.sessionId} />
				</div>
			</Show>

			<Show when={props.onOpen && (hasMore() || previewBlocks().images.length > 0 || textPreview().trim())}>
				<button
					class="result-preview__open"
					onClick={props.onOpen}
					aria-label="Open full result"
				>
					Open result
				</button>
			</Show>
		</div>
	);
}

function ResultFull(props: {
	blocks: NormalizedBlock[];
	status?: ToolStatus;
	onOpenFile?: (path: string) => void;
	sessionId?: string;
}) {
	return (
		<div class="result-full">
			<For each={props.blocks}>
				{(block) => (
					<div class="result-full__block">
						<Switch>
							<Match when={block.kind === "image" ? block : undefined}>
								{(img) => <ImageBlock block={img()} />}
							</Match>
							<Match when={block.kind === "unsafe-image" ? block : undefined}>
								{(unsafe) => (
									<div class="result-error">
										Image omitted: {unsafe().reason} ({unsafe().mimeType || "unknown"})
									</div>
								)}
							</Match>
							<Match when={block.kind === "text" ? block : undefined}>
								{(text) => <TextBlock block={text()} status={props.status} onOpenFile={props.onOpenFile} sessionId={props.sessionId} />}
							</Match>
						</Switch>
						</div>
					)}
				</For>
			</div>
		);
}

function ImageThumbnail(props: { block: Extract<NormalizedBlock, { kind: "image" }>; onClick?: () => void }) {
	return (
		<button
			class="result-image-thumb"
			onClick={props.onClick}
			aria-label="Open image result"
			title="Open image"
		>
			<img
				src={props.block.src}
				alt={props.block.alt}
				loading="lazy"
				draggable={false}
			/>
		</button>
	);
}

function ImageBlock(props: { block: Extract<NormalizedBlock, { kind: "image" }> }) {
	return (
		<div class="result-image-block">
			<img
				src={props.block.src}
				alt={props.block.alt}
				loading="lazy"
				draggable={false}
			/>
		</div>
	);
}

function TextBlock(props: {
	block: Extract<NormalizedBlock, { kind: "text" }>;
	status?: ToolStatus;
	onOpenFile?: (path: string) => void;
	sessionId?: string;
}) {
	const [copied, setCopied] = createSignal(false);

	const copy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* ignore */
		}
	};

	const displayText = () =>
		props.block.variant === "json" && props.block.pretty
			? props.block.pretty
			: props.block.variant === "code" && props.block.code
				? props.block.code
				: props.block.text;
	const delimited = () => {
		const language = props.block.language?.toLowerCase();
		if (props.block.variant !== "code" || (language !== "csv" && language !== "tsv")) return "";
		return renderDelimitedTable(props.block.code ?? "", language === "csv" ? "," : "\t");
	};

	return (
		<div
			class={`result-text result-text--${props.block.variant} ${props.block.isNotice ? "result-text--notice" : ""} ${
				props.status === "error" ? "result-text--error" : ""
			}`}
		>
			<Show when={props.block.variant === "json" || (props.block.variant === "code" && !delimited())}>
				<div class="result-code-header">
					<span class="result-code-header__lang">{props.block.language || props.block.variant}</span>
					<button
						class="result-code-header__copy"
						onClick={() => void copy(displayText())}
						aria-label={copied() ? "Copied" : "Copy to clipboard"}
						title={copied() ? "Copied" : "Copy"}
					>
						{copied() ? "Copied" : "Copy"}
					</button>
				</div>
			</Show>

			<Switch>
				<Match when={props.block.variant === "json"}>
					<pre class="result-code result-code--json">{displayText()}</pre>
				</Match>
				<Match when={props.block.variant === "code" && !!delimited()}>
					<div innerHTML={delimited()} />
				</Match>
				<Match when={props.block.variant === "code"}>
					<pre class="result-code">{displayText()}</pre>
				</Match>
				<Match when={props.block.variant === "markdown"}>
					<Markdown text={props.block.text} onOpenFile={props.onOpenFile} sessionId={props.sessionId} />
				</Match>
				<Match when={props.block.variant === "text"}>
					<p class="result-plain">{props.block.text}</p>
				</Match>
			</Switch>
			<Show when={props.block.variant !== "markdown"}>
				<ArtifactReferences text={props.block.text} onOpenFile={props.onOpenFile} sessionId={props.sessionId} />
			</Show>
		</div>
	);
}

function ArtifactReferences(props: { text: string; onOpenFile?: (path: string) => void; sessionId?: string }) {
	const references = () => extractArtifactReferences(props.text, props.sessionId);
	return (
		<Show when={references().length > 0}>
			<div class="result-references" aria-label="Referenced output files">
				<For each={references()}>
					{(reference) =>
						reference.kind === "image" ? (
							props.onOpenFile ? (
								<button class="result-image-thumb" onClick={() => props.onOpenFile?.(reference.path)} title="Preview image result">
									<img src={reference.src} alt={reference.label} loading="lazy" draggable={false} />
								</button>
							) : (
								<ReferencedImage reference={reference} />
							)
						) : (
							props.onOpenFile ? (
								<button class="result-file-link" onClick={() => props.onOpenFile?.(reference.path)}>
									<span>{reference.label}</span>
									<small>Preview file</small>
								</button>
							) : (
								<a class="result-file-link" href={reference.src} target="_blank" rel="noopener">
									<span>{reference.label}</span>
									<small>Open file</small>
								</a>
							)
						)
					}
				</For>
			</div>
		</Show>
	);
}

function ReferencedImage(props: { reference: ArtifactReference }) {
	return (
		<a class="result-image-thumb" href={props.reference.src} target="_blank" rel="noopener" title="Open image result">
			<img src={props.reference.src} alt={props.reference.label} loading="lazy" draggable={false} />
		</a>
	);
}

function TextOnly(props: {
	text: string;
	status?: ToolStatus;
	onOpenFile?: (path: string) => void;
	sessionId?: string;
}) {
	return (
		<div class={`result-text result-text--text ${props.status === "error" ? "result-text--error" : ""}`}>
			<Markdown text={props.text} onOpenFile={props.onOpenFile} sessionId={props.sessionId} />
		</div>
	);
}

export { textualContent };
