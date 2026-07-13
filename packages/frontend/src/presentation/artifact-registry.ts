import { extractArtifactReferences, imageCount } from "../result";
import type { ToolResultContent } from "../types";

export type ArtifactKind = string;

export interface PublishedArtifactFile {
	path: string;
	label: string;
	kind: "image" | "file";
}

export interface ArtifactPublicationMetadata {
	title?: string;
	kind?: ArtifactKind;
	files: PublishedArtifactFile[];
}

interface ArtifactDetectionContext {
	text: string;
	content: ToolResultContent[];
	references: ReturnType<typeof extractArtifactReferences>;
}

export interface ArtifactKindDefinition {
	kind: ArtifactKind;
	label: string;
	detect?: (context: ArtifactDetectionContext) => boolean;
}

const definitions = new Map<ArtifactKind, ArtifactKindDefinition>();
const detectionOrder: ArtifactKind[] = [];

/** Register or replace one frontend artifact kind without editing the panel. */
export function registerArtifactKind(definition: ArtifactKindDefinition): void {
	if (!definitions.has(definition.kind)) detectionOrder.push(definition.kind);
	definitions.set(definition.kind, definition);
}

export function artifactKindLabel(kind: ArtifactKind): string {
	return definitions.get(kind)?.label ?? kind.replace(/[-_]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

export function artifactKindClass(kind: ArtifactKind): string {
	return (
		kind
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "result"
	);
}

export function inferArtifactKind(text: string, content: ToolResultContent[]): ArtifactKind {
	const context: ArtifactDetectionContext = {
		text,
		content,
		references: extractArtifactReferences(text),
	};
	for (const kind of detectionOrder) {
		const definition = definitions.get(kind);
		if (definition?.detect?.(context)) return kind;
	}
	return "result";
}

export function defaultArtifactTitle(tool: string, kind: ArtifactKind, text: string): string {
	const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
	if (heading) return heading.slice(0, 80);
	return `${tool}: ${artifactKindLabel(kind)}`;
}

/**
 * `details.artifact` is the publication contract. Any current or future tool
 * can publish to the Artifacts panel by returning this metadata envelope.
 */
export function readArtifactPublication(
	details: Record<string, unknown> | undefined,
): ArtifactPublicationMetadata | undefined {
	const value = details?.artifact;
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const artifact = value as Record<string, unknown>;
	const files = Array.isArray(artifact.files)
		? artifact.files.flatMap((entry) => {
				if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
				const file = entry as Record<string, unknown>;
				if (typeof file.path !== "string" || typeof file.label !== "string") return [];
				return [
					{
						path: file.path,
						label: file.label,
						kind: file.kind === "image" ? ("image" as const) : ("file" as const),
					},
				];
			})
		: [];
	return {
		title: typeof artifact.title === "string" ? artifact.title : undefined,
		kind: typeof artifact.kind === "string" && artifact.kind.trim() ? artifact.kind : undefined,
		files,
	};
}

registerArtifactKind({
	kind: "structure",
	label: "Structure",
	detect: ({ references }) => references.some((reference) => /\.(?:pdb|cif|mmcif|mol2)$/i.test(reference.path)),
});
registerArtifactKind({
	kind: "html",
	label: "HTML",
	detect: ({ text, references }) =>
		references.some((reference) => /\.html?$/i.test(reference.path)) ||
		/<!doctype\s+html|<html[\s>]|<body[\s>]/i.test(text),
});
registerArtifactKind({
	kind: "image",
	label: "Image",
	detect: ({ text, content, references }) =>
		imageCount(content) > 0 ||
		references.some((reference) => reference.kind === "image") ||
		/!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|gif|webp)\)/i.test(text),
});
registerArtifactKind({ kind: "data", label: "CSV", detect: ({ text }) => /```(?:csv|tsv)\b/i.test(text) });
registerArtifactKind({
	kind: "table",
	label: "Table",
	detect: ({ text }) => /^\s*\|.+\|\s*$[\s\S]*^\s*\|?\s*:?-{3,}/m.test(text),
});
registerArtifactKind({
	kind: "equation",
	label: "Equation",
	detect: ({ text }) => /\$\$[\s\S]+?\$\$|(?<!\$)\$(?:[^$\\]|\\.)+?\$(?!\$)/.test(text),
});
registerArtifactKind({ kind: "file", label: "Files", detect: ({ references }) => references.length > 0 });
registerArtifactKind({
	kind: "markdown",
	label: "Markdown",
	detect: ({ text }) => /^#{1,6}\s|```|\*\*|^\s*[-*]\s/m.test(text),
});
registerArtifactKind({ kind: "result", label: "Result" });
