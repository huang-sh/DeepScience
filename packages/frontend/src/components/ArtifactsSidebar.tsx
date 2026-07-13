import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import * as api from "../api";
import { collectSessionArtifacts } from "../artifacts";
import { artifactKindClass, artifactKindLabel } from "../presentation/artifact-registry";
import { ArtifactContentRenderer, ArtifactFilePreview } from "../presentation/artifact-renderers";
import {
	activeArtifact,
	activeSessionId,
	activeWorkspaceFile,
	messages,
	workspaceFileError,
	workspaceFileLoading,
} from "../store";
import type { WorkspaceFilePreview } from "../types";

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ArtifactsSidebar() {
	const collected = createMemo(() => collectSessionArtifacts(messages()));
	const artifacts = createMemo(() => {
		const current = activeArtifact();
		if (!current || collected().some((item) => item.id === current.id)) return collected();
		return [
			{
				id: current.id,
				title: current.title,
				tool: current.tool,
				kind: "result" as const,
				content: current.content,
				output: current.output,
				status: "done" as const,
				timestamp: current.timestamp,
				files: [],
			},
			...collected(),
		];
	});
	const [expandedId, setExpandedId] = createSignal<string | null>(null);
	const [filePreview, setFilePreview] = createSignal<WorkspaceFilePreview | null>(null);
	const [fileLoading, setFileLoading] = createSignal(false);
	const [fileError, setFileError] = createSignal("");
	const [workspaceExpanded, setWorkspaceExpanded] = createSignal(true);

	createEffect(() => {
		const current = activeArtifact();
		if (current) setExpandedId(current.id);
	});

	createEffect(() => {
		if (activeWorkspaceFile() || workspaceFileLoading() || workspaceFileError()) setWorkspaceExpanded(true);
	});

	const hasContent = () =>
		artifacts().length > 0 || Boolean(activeWorkspaceFile() || workspaceFileLoading() || workspaceFileError());

	const previewFile = async (path: string): Promise<void> => {
		setFileLoading(true);
		setFileError("");
		setFilePreview(null);
		try {
			setFilePreview(await api.fetchWorkspaceFile(path, activeSessionId() ?? undefined));
		} catch (error) {
			setFileError(error instanceof Error ? error.message : String(error));
		} finally {
			setFileLoading(false);
		}
	};

	return (
		<div class="artifacts-layer">
			<Show
				when={hasContent()}
				fallback={
					<div class="ledger-empty">
						<div class="ledger-empty__title">No artifacts yet</div>
						<div class="ledger-empty__copy">
							Important results explicitly published by the agent appear here. Tool outputs remain available from their Open result buttons.
						</div>
					</div>
				}
			>
				<div class="artifacts-layer__intro">Published results · newest first</div>
				<Show when={activeWorkspaceFile() || workspaceFileLoading() || workspaceFileError()}>
					<article class={`artifact-entry ${workspaceExpanded() ? "is-expanded" : ""}`}>
						<button
							class="artifact-entry__header"
							onClick={() => setWorkspaceExpanded((value) => !value)}
							aria-expanded={workspaceExpanded()}
						>
							<span class="artifact-entry__kind is-file">File</span>
							<span class="artifact-entry__identity">
								<strong>{activeWorkspaceFile()?.name || "Workspace file"}</strong>
								<small>Execution workspace · /{activeWorkspaceFile()?.path ?? ""}</small>
							</span>
							<span class="artifact-entry__chevron" aria-hidden="true">›</span>
						</button>
						<Show when={workspaceExpanded()}>
							<div class="artifact-entry__content">
								<Show when={workspaceFileLoading()}>
									<div class="artifact-file-preview__empty">Loading file preview…</div>
								</Show>
								<Show when={workspaceFileError()}>
									<div class="artifact-file-preview__empty is-error">{workspaceFileError()}</div>
								</Show>
								<Show when={activeWorkspaceFile()}>
									{(file) => <ArtifactFilePreview file={file()} sessionId={activeSessionId() ?? undefined} />}
								</Show>
							</div>
						</Show>
					</article>
				</Show>
				<For each={artifacts()}>
					{(artifact) => {
						const expanded = () => expandedId() === artifact.id;
						return (
							<article class={`artifact-entry ${expanded() ? "is-expanded" : ""}`}>
								<button
									class="artifact-entry__header"
									onClick={() => {
										setExpandedId(expanded() ? null : artifact.id);
										setFilePreview(null);
										setFileError("");
									}}
									aria-expanded={expanded()}
								>
									<span class={`artifact-entry__kind is-${artifactKindClass(artifact.kind)}`}>
										{artifactKindLabel(artifact.kind)}
									</span>
									<span class="artifact-entry__identity">
										<strong>{artifact.title}</strong>
										<small>{artifact.tool} · {formatTime(artifact.timestamp)}</small>
									</span>
									<span class="artifact-entry__chevron" aria-hidden="true">›</span>
								</button>

								<Show when={expanded()}>
									<div class="artifact-entry__content">
									<ArtifactContentRenderer
										artifact={artifact}
										sessionId={activeSessionId() ?? undefined}
										onOpenFile={(path) => void previewFile(path)}
									/>

										<Show when={artifact.files.length > 0}>
											<div class="artifact-entry__files">
												<For each={artifact.files}>
													{(file) => (
														<button onClick={() => void previewFile(file.path)}>
															<span>{file.kind === "image" ? "Image" : "File"}</span>
															{file.label}
														</button>
													)}
												</For>
											</div>
										</Show>

										<Show when={fileLoading()}><div class="artifact-file-preview__empty">Loading file preview…</div></Show>
										<Show when={fileError()}><div class="artifact-file-preview__empty is-error">{fileError()}</div></Show>
										<Show when={filePreview()}>
											{(file) => <ArtifactFilePreview file={file()} sessionId={activeSessionId() ?? undefined} />}
										</Show>
									</div>
								</Show>
							</article>
						);
					}}
				</For>
			</Show>
		</div>
	);
}
