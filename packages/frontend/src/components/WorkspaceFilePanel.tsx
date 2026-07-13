import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { workspaceFileRawUrl } from "../api";
import {
	activeSessionId,
	activeWorkspaceFile,
	closeWorkspaceFile,
	workspaceFileError,
	workspaceFileLoading,
	workspaceSelection,
} from "../store";

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkspaceFilePanel() {
	const [copied, setCopied] = createSignal(false);
	const rawUrl = (path: string) =>
		workspaceFileRawUrl(path, activeSessionId() ?? undefined, workspaceSelection()?.directory);

	createEffect(() => {
		if (!activeWorkspaceFile() && !workspaceFileLoading() && !workspaceFileError()) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeWorkspaceFile();
		};
		document.addEventListener("keydown", onKeyDown);
		onCleanup(() => document.removeEventListener("keydown", onKeyDown));
	});

	const copy = async (content: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* clipboard unavailable */
		}
	};

	return (
		<aside class="artifact-panel workspace-file-panel" role="complementary" aria-label="Workspace file preview">
			<header class="artifact-panel__header">
				<div class="artifact-panel__title-group">
					<div class="artifact-panel__eyebrow">{activeSessionId() ? "Execution workspace" : "Workspace"}</div>
					<div class="artifact-panel__title">{activeWorkspaceFile()?.name || "File preview"}</div>
				</div>
				<div class="artifact-panel__actions">
					<Show when={activeWorkspaceFile()?.content}>
						<button class="artifact-panel__copy" onClick={() => void copy(activeWorkspaceFile()?.content ?? "")}>
							{copied() ? "✓" : "Copy"}
						</button>
					</Show>
					<button class="artifact-panel__close" aria-label="Close file preview" onClick={closeWorkspaceFile}>×</button>
				</div>
			</header>

			<div class="workspace-file-panel__path" title={activeWorkspaceFile()?.path}>
				/{activeWorkspaceFile()?.path || ""}
			</div>

			<div class="artifact-panel__body workspace-file-panel__body">
				<Show when={workspaceFileLoading()}>
					<div class="workspace-file-panel__empty">Loading file…</div>
				</Show>
				<Show when={workspaceFileError()}>
					<div class="workspace-file-panel__empty is-error">{workspaceFileError()}</div>
				</Show>
				<Show when={activeWorkspaceFile()}>
					{(file) => (
						<>
							<Show when={file().previewType === "image"}>
								<img
									class="workspace-file-panel__image"
									src={rawUrl(file().path)}
									alt={file().name}
								/>
							</Show>
							<Show when={file().previewType === "text"}>
								<pre class="workspace-file-panel__text">{file().content}</pre>
							</Show>
							<Show when={file().previewType === "unsupported"}>
								<div class="workspace-file-panel__empty">{file().content}</div>
							</Show>
							<footer class="workspace-file-panel__meta">
								<span>{file().mimeType}</span>
								<span>{formatBytes(file().size)}</span>
								<a href={rawUrl(file().path)} target="_blank" rel="noopener">
									Open raw
								</a>
							</footer>
						</>
					)}
				</Show>
			</div>
		</aside>
	);
}
