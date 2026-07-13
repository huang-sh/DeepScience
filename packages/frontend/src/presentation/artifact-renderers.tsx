import type { Component } from "solid-js";
import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import * as api from "../api";
import type { SessionArtifact } from "../artifacts";
import type { WorkspaceFilePreview } from "../types";
import HtmlArtifact from "../components/HtmlArtifact";
import Markdown, { renderDelimitedTable } from "../components/Markdown";
import ResultRenderer from "../components/ResultRenderer";
import StructureArtifact from "../components/StructureArtifact";
import { extractEmbeddedStructure, structureFormatFromFilename } from "../structure";

export interface ArtifactRendererProps {
	artifact: SessionArtifact;
	sessionId?: string;
	onOpenFile(path: string): void;
}

const artifactRenderers = new Map<string, Component<ArtifactRendererProps>>();

/** Register or replace the renderer for an artifact kind. */
export function registerArtifactRenderer(kind: string, renderer: Component<ArtifactRendererProps>): void {
	artifactRenderers.set(kind, renderer);
}

export function ArtifactContentRenderer(props: ArtifactRendererProps) {
	const Renderer = artifactRenderers.get(props.artifact.kind) ?? DefaultArtifactRenderer;
	return <Renderer {...props} />;
}

function artifactText(artifact: SessionArtifact): string {
	const text = artifact.content
		.filter((block): block is Extract<SessionArtifact["content"][number], { type: "text" }> => block.type === "text")
		.map((block) => block.text)
		.join("\n");
	return text || artifact.output || "";
}

function DefaultArtifactRenderer(props: ArtifactRendererProps) {
	return (
		<ResultRenderer
			content={props.artifact.content}
			output={props.artifact.output}
			status={props.artifact.status}
			preview={false}
			onOpenFile={props.onOpenFile}
			sessionId={props.sessionId}
			ariaLabel={`${props.artifact.title} artifact`}
		/>
	);
}

function PublishedHtmlArtifact(props: ArtifactRendererProps) {
	const [fileHtml, setFileHtml] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal("");
	const htmlFile = () => props.artifact.files.find((file) => /\.html?$/i.test(file.path));
	const html = () => fileHtml() || artifactText(props.artifact);
	const embeddedStructure = () => extractEmbeddedStructure(html());

	createEffect(() => {
		const file = htmlFile();
		if (!file) return;
		let active = true;
		setLoading(true);
		setError("");
		setFileHtml("");
		void api.fetchWorkspaceFile(file.path, props.sessionId)
			.then((preview) => {
				if (!active) return;
				if (preview.previewType !== "text" || preview.mimeType !== "text/html") {
					throw new Error("HTML file is not available as a text preview.");
				}
				setFileHtml(preview.content);
			})
			.catch((cause) => {
				if (active) setError(cause instanceof Error ? cause.message : String(cause));
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		onCleanup(() => {
			active = false;
		});
	});

	return (
		<Show when={!loading()} fallback={<div class="artifact-file-preview__empty">Loading HTML preview…</div>}>
			<Show when={!error()} fallback={<div class="artifact-file-preview__empty is-error">{error()}</div>}>
				<Show when={embeddedStructure()} fallback={<HtmlArtifact html={html()} title={props.artifact.title} />}>
					{(structure) => (
						<StructureArtifact
							data={structure().data}
							format={structure().format}
							title={props.artifact.title}
						/>
					)}
				</Show>
			</Show>
		</Show>
	);
}

function PublishedStructureArtifact(props: ArtifactRendererProps) {
	const structureFile = () => props.artifact.files.find((file) => structureFormatFromFilename(file.path) !== null);
	const [preview, setPreview] = createSignal<WorkspaceFilePreview | null>(null);
	const [error, setError] = createSignal("");

	createEffect(() => {
		const file = structureFile();
		if (!file) {
			setError("No PDB, CIF, mmCIF, or MOL2 file was published with this artifact.");
			return;
		}
		let active = true;
		setPreview(null);
		setError("");
		void api.fetchWorkspaceFile(file.path, props.sessionId)
			.then((value) => {
				if (active) setPreview(value);
			})
			.catch((cause) => {
				if (active) setError(cause instanceof Error ? cause.message : String(cause));
			});
		onCleanup(() => {
			active = false;
		});
	});

	return (
		<Show when={!error()} fallback={<div class="artifact-file-preview__empty is-error">{error()}</div>}>
			<Show when={preview()} fallback={<div class="artifact-file-preview__empty">Loading structure…</div>}>
				{(file) => (
					<StructureArtifact
						data={file().content}
						format={structureFormatFromFilename(file().name) ?? "pdb"}
						title={props.artifact.title}
					/>
				)}
			</Show>
		</Show>
	);
}

export interface FilePreviewRendererProps {
	file: WorkspaceFilePreview;
	rawUrl: string;
}

export interface FilePreviewRendererDefinition {
	id: string;
	matches(file: WorkspaceFilePreview): boolean;
	renderer: Component<FilePreviewRendererProps>;
}

const filePreviewRenderers: FilePreviewRendererDefinition[] = [];

/** Register a file preview renderer. Higher priority renderers are checked first. */
export function registerFilePreviewRenderer(definition: FilePreviewRendererDefinition, priority = 0): void {
	const existing = filePreviewRenderers.findIndex((candidate) => candidate.id === definition.id);
	if (existing >= 0) filePreviewRenderers.splice(existing, 1);
	if (priority > 0) filePreviewRenderers.unshift(definition);
	else filePreviewRenderers.push(definition);
}

export function ArtifactFilePreview(props: { file: WorkspaceFilePreview; sessionId?: string }) {
	const rawUrl = () => api.workspaceFileRawUrl(props.file.path, props.sessionId);
	const definition = createMemo(
		() => filePreviewRenderers.find((candidate) => candidate.matches(props.file)) ?? unsupportedFileRenderer,
	);
	return (
		<section class="artifact-file-preview">
			<header>
				<div><strong>{props.file.name}</strong><small>/{props.file.path}</small></div>
				<a href={rawUrl()} target="_blank" rel="noopener">Open raw</a>
			</header>
			{(() => {
				const Renderer = definition().renderer;
				return <Renderer file={props.file} rawUrl={rawUrl()} />;
			})()}
		</section>
	);
}

function fileExtension(file: WorkspaceFilePreview): string {
	return file.name.toLowerCase().split(".").pop() ?? "";
}

function ImageFilePreview(props: FilePreviewRendererProps) {
	return <img src={props.rawUrl} alt={props.file.name} loading="lazy" />;
}

function DelimitedFilePreview(props: FilePreviewRendererProps) {
	const delimiter = fileExtension(props.file) === "tsv" || props.file.mimeType === "text/tab-separated-values" ? "\t" : ",";
	return <div innerHTML={renderDelimitedTable(props.file.content, delimiter)} />;
}

function HtmlFilePreview(props: FilePreviewRendererProps) {
	return <HtmlArtifact html={props.file.content} title={props.file.name} />;
}

function StructureFilePreview(props: FilePreviewRendererProps) {
	return (
		<StructureArtifact
			data={props.file.content}
			format={structureFormatFromFilename(props.file.name) ?? "pdb"}
			title={props.file.name}
		/>
	);
}

function MarkdownFilePreview(props: FilePreviewRendererProps) {
	return <div class="artifact-file-preview__markdown"><Markdown text={props.file.content} /></div>;
}

function TextFilePreview(props: FilePreviewRendererProps) {
	return <pre>{props.file.content}</pre>;
}

function UnsupportedFilePreview(props: FilePreviewRendererProps) {
	return <div class="artifact-file-preview__empty">{props.file.content}</div>;
}

const unsupportedFileRenderer: FilePreviewRendererDefinition = {
	id: "unsupported",
	matches: () => true,
	renderer: UnsupportedFilePreview,
};

registerArtifactRenderer("html", PublishedHtmlArtifact);
registerArtifactRenderer("structure", PublishedStructureArtifact);

registerFilePreviewRenderer({ id: "image", matches: (file) => file.previewType === "image", renderer: ImageFilePreview });
registerFilePreviewRenderer({
	id: "delimited",
	matches: (file) =>
		file.previewType === "text" &&
		(["csv", "tsv"].includes(fileExtension(file)) || ["text/csv", "text/tab-separated-values"].includes(file.mimeType)),
	renderer: DelimitedFilePreview,
});
registerFilePreviewRenderer({
	id: "html",
	matches: (file) => file.previewType === "text" && ["html", "htm"].includes(fileExtension(file)),
	renderer: HtmlFilePreview,
});
registerFilePreviewRenderer({
	id: "structure",
	matches: (file) => file.previewType === "text" && structureFormatFromFilename(file.name) !== null,
	renderer: StructureFilePreview,
});
registerFilePreviewRenderer({
	id: "markdown",
	matches: (file) => file.previewType === "text" && ["md", "markdown"].includes(fileExtension(file)),
	renderer: MarkdownFilePreview,
});
registerFilePreviewRenderer({ id: "text", matches: (file) => file.previewType === "text", renderer: TextFilePreview });
