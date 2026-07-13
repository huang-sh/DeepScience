import {
	type ArtifactKind,
	defaultArtifactTitle,
	inferArtifactKind,
	readArtifactPublication,
} from "./presentation/artifact-registry";
import { extractArtifactReferences, summarizeContent } from "./result";
import type { ChatMessage, ToolResultContent, ToolStatus } from "./types";

export interface SessionArtifact {
	id: string;
	title: string;
	tool: string;
	kind: ArtifactKind;
	content: ToolResultContent[];
	output?: string;
	status: ToolStatus;
	timestamp: number;
	files: Array<{ path: string; label: string; kind: "image" | "file" }>;
}

export function collectSessionArtifacts(messages: ChatMessage[]): SessionArtifact[] {
	const artifacts: SessionArtifact[] = [];
	for (const message of messages) {
		for (const part of message.parts) {
			if (part.kind === "tool" && part.status === "done") {
				const metadata = readArtifactPublication(part.details);
				if (!metadata) continue;
				const content = part.content ?? [];
				const text = summarizeContent(content, Number.MAX_SAFE_INTEGER) || part.output || "";
				if (content.length === 0 && !text.trim() && metadata.files.length === 0) continue;
				const kind = metadata.kind ?? inferArtifactKind(text, content);
				const referencedFiles = extractArtifactReferences(text).map(({ path, label, kind: fileKind }) => ({
					path,
					label,
					kind: fileKind,
				}));
				artifacts.push({
					id: part.id,
					title: metadata.title ?? defaultArtifactTitle(part.tool, kind, text),
					tool: part.tool,
					kind,
					content,
					output: part.output,
					status: part.status,
					timestamp: message.timestamp,
					files: [...metadata.files, ...referencedFiles].filter(
						(file, index, all) => all.findIndex((candidate) => candidate.path === file.path) === index,
					),
				});
			}
		}
	}
	return artifacts.sort((left, right) => right.timestamp - left.timestamp);
}

export type { ArtifactKind } from "./presentation/artifact-registry";
