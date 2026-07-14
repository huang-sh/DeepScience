import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Portal } from "solid-js/web"
import * as api from "../api"
import type { WorkspaceDirectoryListing } from "../types"
import {
  setLeftCollapsed,
  activeLeftTab,
  setActiveLeftTab,
  newChat,
  sessionList,
  activeSessionId,
  loadSession,
  deleteSession,
  forkSession,
  session,
  messages,
  workspaceFiles,
  workspacePath,
  workspaceParentPath,
  workspaceRoot,
  workspaceFilesLoading,
  workspaceFilesError,
  workspaceFilesTruncated,
  loadWorkspaceFiles,
  openWorkspaceFile,
  activeWorkspaceFile,
  workspaceSelection,
  workspaceProjects,
  refreshWorkspaceProjects,
  selectWorkspace,
  streaming,
} from "../store"

function formatRelative(ts: number): string {
  if (!ts) return ""
  const diff = Date.now() - ts
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function SessionSidebar() {
	createEffect(() => {
		const tab = activeLeftTab()
		const sessionId = activeSessionId()
		if (tab === "files") {
			void sessionId
			void loadWorkspaceFiles("", true)
		}
	})

  return (
    <aside class="archive-panel" aria-label="Project and session sidebar">
      <div class="archive-panel__mast">
        <div>
          <div class="archive-panel__eyebrow">Project</div>
          <div class="archive-panel__title">DeepScience</div>
        </div>
        <div class="archive-panel__mast-actions">
          <button
            class="archive-search__btn"
            onClick={() => setLeftCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            Collapse
          </button>
        </div>
      </div>

      <WorkspaceControl />

      <div class="archive-tabs" role="tablist" aria-label="Sidebar tabs">
        <button
          class={`archive-tab ${activeLeftTab() === "tasks" ? "is-active" : ""}`}
          onClick={() => setActiveLeftTab("tasks")}
          role="tab"
          aria-selected={activeLeftTab() === "tasks"}
        >
          Tasks
        </button>
        <button
          class={`archive-tab ${activeLeftTab() === "files" ? "is-active" : ""}`}
          onClick={() => setActiveLeftTab("files")}
          role="tab"
          aria-selected={activeLeftTab() === "files"}
        >
          Files
        </button>
      </div>

      <Show when={activeLeftTab() === "tasks"}>
        <TasksTab />
      </Show>
      <Show when={activeLeftTab() === "files"}>
        <FilesTab />
      </Show>
    </aside>
  )
}

function WorkspaceControl() {
	const [mode, setMode] = createSignal<"new" | "open" | null>(null)

	onMount(() => { void refreshWorkspaceProjects().catch(() => undefined) })

	return (
		<section class="workspace-control" aria-label="Current workspace">
			<div class="workspace-control__current">
				<div class="workspace-control__mark" aria-hidden="true">
					<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1.8 4.5h4l1.2 1.4h7.2v6.7H1.8z" /><path d="M1.8 4.5V3.2h4.6l1.1 1.3" />
					</svg>
				</div>
				<div class="workspace-control__identity">
					<div class="workspace-control__label">Workspace</div>
					<div class="workspace-control__name">{workspaceSelection()?.title ?? "Loading…"}</div>
					<div class="workspace-control__path" title={workspaceSelection()?.directory}>
						{workspaceSelection()?.directory ?? "Resolving project directory"}
					</div>
				</div>
			</div>
			<div class="workspace-control__actions">
				<button disabled={streaming()} onClick={() => setMode("new")}>+ New</button>
				<button disabled={streaming()} onClick={() => setMode("open")}>Open</button>
			</div>
			<Show when={mode()}>
				{(selectedMode) => (
					<WorkspaceDialog initialMode={selectedMode()} onClose={() => setMode(null)} />
				)}
			</Show>
		</section>
	)
}

function WorkspaceDialog(props: { initialMode: "new" | "open"; onClose: () => void }) {
	const [mode, setMode] = createSignal(props.initialMode)
	const [browser, setBrowser] = createSignal<WorkspaceDirectoryListing | null>(null)
	const [workspaceName, setWorkspaceName] = createSignal("")
	const [browserLoading, setBrowserLoading] = createSignal(false)
	const [busy, setBusy] = createSignal(false)
	const [error, setError] = createSignal("")
	let nameInput: HTMLInputElement | undefined
	const recent = createMemo(() => {
		const seen = new Set<string>()
		return workspaceProjects().flatMap((project) =>
			project.directories
				.filter((path) => {
					if (seen.has(path)) return false
					seen.add(path)
					return true
				})
				.map((path) => ({ path, title: project.title })),
		)
	})

	onMount(() => {
		void refreshWorkspaceProjects().catch(() => undefined)
		void loadDirectory(workspaceSelection()?.directory)
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busy()) props.onClose()
		}
		document.addEventListener("keydown", onKeyDown)
		onCleanup(() => document.removeEventListener("keydown", onKeyDown))
	})

	const changeMode = (next: "new" | "open") => {
		setMode(next)
		setWorkspaceName("")
		setError("")
		if (next === "new") queueMicrotask(() => nameInput?.focus())
	}

	const loadDirectory = async (path?: string) => {
		setBrowserLoading(true)
		setError("")
		try {
			setBrowser(await api.browseWorkspaceDirectories(path))
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		} finally {
			setBrowserLoading(false)
		}
	}

	const workspacePath = () => {
		const parent = browser()?.directory
		const name = workspaceName().trim()
		if (!parent || !name) return ""
		const separator = parent.includes("\\") && !parent.includes("/") ? "\\" : "/"
		return `${parent.endsWith("/") || parent.endsWith("\\") ? parent : `${parent}${separator}`}${name}`
	}

	const apply = async (recentPath?: string) => {
		const value = recentPath ?? (mode() === "new" ? workspacePath() : browser()?.directory ?? "")
		if (!value) {
			setError(mode() === "new" ? "Enter a workspace name." : "Select a workspace directory.")
			nameInput?.focus()
			return
		}
		if (mode() === "new" && !/^[^/\\]+$/.test(workspaceName().trim())) {
			setError("Workspace name cannot contain path separators.")
			nameInput?.focus()
			return
		}
		setBusy(true)
		setError("")
		try {
			await selectWorkspace(value, recentPath ? false : mode() === "new")
			props.onClose()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		} finally {
			setBusy(false)
		}
	}

	return (
		<Portal>
			<div
				class="modal-backdrop workspace-dialog-backdrop"
				onClick={(event) => {
					if (event.target === event.currentTarget && !busy()) props.onClose()
				}}
			>
				<section class="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title">
					<header class="workspace-dialog__header">
						<div>
							<div class="workspace-dialog__eyebrow">DeepScience workspace</div>
							<h2 id="workspace-dialog-title">{mode() === "new" ? "Create workspace" : "Open workspace"}</h2>
						</div>
						<button class="workspace-dialog__close" disabled={busy()} onClick={props.onClose} aria-label="Close workspace dialog">×</button>
					</header>

					<div class="workspace-dialog__tabs" role="tablist" aria-label="Workspace action">
						<button class={mode() === "new" ? "is-active" : ""} onClick={() => changeMode("new")} role="tab" aria-selected={mode() === "new"}>New workspace</button>
						<button class={mode() === "open" ? "is-active" : ""} onClick={() => changeMode("open")} role="tab" aria-selected={mode() === "open"}>Open workspace</button>
					</div>

					<div class="workspace-dialog__body">
						<div class="workspace-dialog__current">
							<span>Current workspace</span>
							<strong>{workspaceSelection()?.title ?? "DeepScience"}</strong>
							<small>{workspaceSelection()?.directory}</small>
						</div>
						<Show when={mode() === "new"}>
							<label class="workspace-dialog__field" for="workspace-dialog-name">
								<span>Workspace name</span>
								<input
									ref={nameInput}
									id="workspace-dialog-name"
									value={workspaceName()}
									onInput={(event) => setWorkspaceName(event.currentTarget.value)}
									onKeyDown={(event) => { if (event.key === "Enter") void apply() }}
									placeholder="my-research-project"
									disabled={busy()}
								/>
								<small>The workspace will be created inside the selected folder below.</small>
							</label>
						</Show>

						<div class="workspace-dialog__browser">
							<div class="workspace-dialog__browser-bar">
								<button
									disabled={busy() || browserLoading() || !browser() || browser()?.parent === browser()?.directory}
									onClick={() => void loadDirectory(browser()?.parent)}
									aria-label="Open parent directory"
								>↑</button>
								<div title={browser()?.directory}>{browser()?.directory ?? "Loading directories…"}</div>
							</div>
							<Show
								when={!browserLoading()}
								fallback={<div class="workspace-dialog__browser-empty">Loading folders…</div>}
							>
								<Show
									when={(browser()?.directories.length ?? 0) > 0}
									fallback={<div class="workspace-dialog__browser-empty">This folder has no subfolders.</div>}
								>
									<div class="workspace-dialog__browser-list">
										<For each={browser()?.directories ?? []}>
											{(entry) => (
												<button disabled={busy()} onClick={() => void loadDirectory(entry.path)} title={entry.path}>
													<span aria-hidden="true">▸</span>{entry.name}
												</button>
											)}
										</For>
									</div>
								</Show>
							</Show>
						</div>

						<Show when={mode() === "open" && recent().length > 0}>
							<div class="workspace-dialog__recent-title">Recent workspaces</div>
							<div class="workspace-dialog__recent">
								<For each={recent()}>
									{(item) => (
										<button disabled={busy()} title={item.path} onClick={() => void apply(item.path)}>
											<span>{item.title}</span><small>{item.path}</small>
										</button>
									)}
								</For>
							</div>
						</Show>
						<Show when={error()}><div class="workspace-dialog__error">{error()}</div></Show>
					</div>

					<footer class="workspace-dialog__footer">
						<button class="workspace-dialog__cancel" disabled={busy()} onClick={props.onClose}>Cancel</button>
						<button class="workspace-dialog__confirm" disabled={busy() || browserLoading()} onClick={() => void apply()}>
							{busy() ? "Working…" : mode() === "new" ? "Create in this folder" : "Open this folder"}
						</button>
					</footer>
				</section>
			</div>
		</Portal>
	)
}

function fileKind(entry: { type: "directory" | "file"; name: string }): string {
	if (entry.type === "directory") return "folder"
	const extension = entry.name.toLowerCase().split(".").pop() ?? ""
	if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return "image"
	if (["py", "r", "js", "ts", "tsx", "jsx", "sh", "sql"].includes(extension)) return "code"
	if (["csv", "tsv", "json", "h5ad", "parquet"].includes(extension)) return "data"
	return "document"
}

function formatFileSize(size: number): string {
	if (!size) return ""
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function FilesTab() {
	const [filter, setFilter] = createSignal("")
	const filteredFiles = createMemo(() => {
		const query = filter().trim().toLowerCase()
		if (!query) return workspaceFiles()
		return workspaceFiles().filter((entry) => `${entry.name} ${entry.path}`.toLowerCase().includes(query))
	})

	return (
		<>
			<div class="archive-search archive-search--files">
				<input
					class="archive-search__input"
					value={filter()}
					onInput={(event) => setFilter(event.currentTarget.value)}
					placeholder="Search workspace files…"
				/>
				<button
					class="archive-search__btn archive-search__btn--icon"
					onClick={() => void loadWorkspaceFiles(workspacePath(), true)}
					title="Refresh files"
					aria-label="Refresh workspace files"
				>
					↻
				</button>
			</div>

			<div class="workspace-pathbar">
				<button
					class="workspace-pathbar__back"
					disabled={workspaceFilesLoading() || !workspacePath()}
					onClick={() => void loadWorkspaceFiles(workspaceParentPath())}
					aria-label="Open parent directory"
				>
					←
				</button>
				<div class="workspace-pathbar__location">
					<div class="workspace-pathbar__relative" title={workspaceRoot()}>
						/{workspacePath()}
					</div>
					<div class="workspace-pathbar__scope">
						{activeSessionId()
							? session()?.workspaceKind === "git-worktree"
								? "Current session · Git worktree workspace"
								: session()?.directory !== session()?.projectDirectory
									? "Current session · session-bound workspace"
									: "Current session · selected workspace"
							: "Project workspace"}
					</div>
				</div>
			</div>
			<div class="workspace-root-path" title={workspaceRoot()}>
				{activeSessionId() ? "Execution workspace" : "Workspace"}: {workspaceRoot() || "Loading workspace…"}
				<Show when={session()?.projectDirectory && session()?.directory !== session()?.projectDirectory}>
					{(projectDirectory) => <><br />Selected workspace: {projectDirectory()}</>}
				</Show>
			</div>

			<div class="archive-list">
				<Show when={workspaceFilesLoading()}>
					<div class="archive-empty">Reading workspace files…</div>
				</Show>
				<Show when={!workspaceFilesLoading() && workspaceFilesError()}>
					<div class="archive-empty archive-empty--error">{workspaceFilesError()}</div>
				</Show>
				<Show when={!workspaceFilesLoading() && !workspaceFilesError() && filteredFiles().length === 0}>
					<div class="archive-empty">
						{!activeSessionId()
							? filter()
								? "No matching files."
								: "This project workspace is empty."
							: filter()
								? "No matching files."
								: "This execution workspace is empty."}
					</div>
				</Show>
				<For each={filteredFiles()}>
					{(entry) => (
						<article
							class={`workspace-file-entry ${entry.type === "directory" ? "is-directory" : ""} ${activeWorkspaceFile()?.path === entry.path ? "is-active" : ""}`}
							role="button"
							tabindex={0}
							onClick={() => entry.type === "directory" ? void loadWorkspaceFiles(entry.path) : void openWorkspaceFile(entry.path)}
							onKeyDown={(event) => {
								if (event.key !== "Enter" && event.key !== " ") return
								event.preventDefault()
								if (entry.type === "directory") void loadWorkspaceFiles(entry.path)
								else void openWorkspaceFile(entry.path)
							}}
						>
							<div class={`workspace-file-entry__icon is-${fileKind(entry)}`} aria-hidden="true">
								{entry.type === "directory" ? "▸" : fileKind(entry).slice(0, 1).toUpperCase()}
							</div>
							<div class="workspace-file-entry__main">
								<div class="workspace-file-entry__name">{entry.name}</div>
								<div class="workspace-file-entry__meta">
									{entry.type === "directory" ? "Directory" : `${fileKind(entry)} · ${formatFileSize(entry.size)}`}
								</div>
							</div>
						</article>
					)}
				</For>
				<Show when={workspaceFilesTruncated()}>
					<div class="archive-empty">Only the first 1,000 entries are shown.</div>
				</Show>
			</div>
		</>
	)
}

function TasksTab() {
  const currentSession = () => session()
  const msgCount = () => messages().length
  const list = () => {
	const selected = workspaceSelection()
	if (!selected) return sessionList()
	return sessionList().filter((item) =>
		item.projectDirectory ? item.projectDirectory === selected.directory : item.projectID === selected.projectID,
	)
  }
  const hasCurrent = () => currentSession() || msgCount() > 0
	const [deletingId, setDeletingId] = createSignal<string | null>(null)
	const [forkingId, setForkingId] = createSignal<string | null>(null)
	const [actionError, setActionError] = createSignal("")
	const [pendingDelete, setPendingDelete] = createSignal<{ id: string; title: string } | null>(null)
	const [deleteDialogError, setDeleteDialogError] = createSignal("")

	const requestRemove = (item: { id: string; title: string }) => {
		setDeleteDialogError("")
		setPendingDelete(item)
	}

	const remove = async () => {
		const item = pendingDelete()
		if (!item) return
		setDeletingId(item.id)
		setActionError("")
		setDeleteDialogError("")
		try {
			await deleteSession(item.id)
			setPendingDelete(null)
		} catch (error) {
			setDeleteDialogError(error instanceof Error ? error.message : String(error))
		} finally {
			setDeletingId(null)
		}
	}

	const fork = async (item: { id: string }) => {
		setForkingId(item.id)
		setActionError("")
		try {
			await forkSession(item.id)
		} catch (error) {
			setActionError(`Could not fork session: ${error instanceof Error ? error.message : String(error)}`)
		} finally {
			setForkingId(null)
		}
	}

  return (
    <>
      <div class="archive-search">
        <button
          type="button"
          class="archive-search__btn archive-search__btn--primary"
          onClick={() => {
			newChat()
			requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("#landing-input")?.focus())
		  }}
        >
          + New task
        </button>
      </div>

      <div class="archive-list">
		<Show when={actionError()}>
			<div class="archive-delete-error">{actionError()}</div>
		</Show>
        <Show when={list().length > 0} fallback={
          <Show when={hasCurrent()} fallback={
            <div class="archive-empty">
              <div class="archive-empty__title">No tasks yet</div>
              <div class="archive-empty__copy">Start a conversation to create a research task.</div>
            </div>
          }>
            <div class="archive-group__label">Current</div>
            <article class="archive-entry is-active">
              <div class="archive-entry__row">
                <div class="archive-entry__dot" />
                <div class="archive-entry__main">
                  <div class="archive-entry__title">
                    {currentSession()?.title || "Current session"}
                  </div>
                  <div class="archive-entry__preview">
                    {msgCount()} messages
                  </div>
                </div>
              </div>
            </article>
          </Show>
        }>
          <For each={list()}>
            {(s) => (
              <article
                class={`archive-entry ${s.id === activeSessionId() ? "is-active" : ""}`}
                onClick={() => void loadSession(s.id)}
                role="button"
                tabindex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    void loadSession(s.id)
                  }
                }}
                aria-label={`Load task ${s.title}`}
              >
                <div class="archive-entry__row">
                  <div class="archive-entry__dot" />
                  <div class="archive-entry__main">
                    <div class="archive-entry__title">{s.title}</div>
                    <div class="archive-entry__preview">
                      {s.preview || `${s.messageCount} messages`}
                    </div>
                  </div>
                  <div class="archive-entry__meta-stack">
                    <div class="archive-entry__meta">{formatRelative(s.updatedAt ?? 0)}</div>
					<div class="archive-entry__actions">
						<button
							class="archive-entry__action archive-entry__fork"
							disabled={forkingId() === s.id || deletingId() === s.id}
							title="Fork session"
							aria-label={`Fork task ${s.title}`}
							onClick={(event) => {
								event.stopPropagation()
								void fork(s)
							}}
							onKeyDown={(event) => event.stopPropagation()}
						>
							{forkingId() === s.id ? <span class="tool-card__spinner" /> : (
								<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
									<circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="13" r="1.5" /><circle cx="12" cy="5" r="1.5" />
									<path d="M4 4.5v7M5.5 11.5c0-4 6.5-2.5 6.5-5" stroke-linecap="round" />
								</svg>
							)}
						</button>
						<button
							class="archive-entry__action archive-entry__delete"
							disabled={deletingId() === s.id || forkingId() === s.id}
							title="Delete session"
							aria-label={`Delete task ${s.title}`}
							onClick={(event) => {
								event.stopPropagation()
								requestRemove(s)
							}}
							onKeyDown={(event) => event.stopPropagation()}
						>
							{deletingId() === s.id ? <span class="tool-card__spinner" /> : (
								<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
									<path d="M3 4.5h10M6 2.5h4M5 4.5l.5 9h5l.5-9M6.75 7v4M9.25 7v4" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							)}
						</button>
					</div>
                  </div>
                </div>
              </article>
            )}
          </For>
        </Show>
      </div>
	  <Show when={pendingDelete()}>
		{(item) => (
			<DeleteSessionDialog
				item={item()}
				busy={deletingId() === item().id}
				error={deleteDialogError()}
				onCancel={() => {
					if (deletingId()) return
					setPendingDelete(null)
					setDeleteDialogError("")
				}}
				onConfirm={() => void remove()}
			/>
		)}
	  </Show>
    </>
  )
}

function DeleteSessionDialog(props: {
	item: { id: string; title: string }
	busy: boolean
	error: string
	onCancel: () => void
	onConfirm: () => void
}) {
	let cancelButton: HTMLButtonElement | undefined

	onMount(() => {
		cancelButton?.focus()
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !props.busy) props.onCancel()
		}
		document.addEventListener("keydown", onKeyDown)
		onCleanup(() => document.removeEventListener("keydown", onKeyDown))
	})

	return (
		<div
			class="modal-backdrop session-delete-backdrop"
			onClick={(event) => {
				if (event.target === event.currentTarget && !props.busy) props.onCancel()
			}}
		>
			<section
				class="session-delete-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="session-delete-title"
				aria-describedby="session-delete-description"
			>
				<header class="session-delete-dialog__header">
					<div class="session-delete-dialog__icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
							<path d="M4 7h16M9 3h6M7 7l1 14h8l1-14M10 11v6M14 11v6" />
						</svg>
					</div>
					<div>
						<div class="session-delete-dialog__eyebrow">Permanent action</div>
						<h2 id="session-delete-title">Delete this session?</h2>
					</div>
				</header>

				<div class="session-delete-dialog__body">
					<div class="session-delete-dialog__session">
						<span>Session</span>
						<strong>{props.item.title}</strong>
					</div>
					<p id="session-delete-description">This permanently removes the research task and everything owned by it:</p>
					<ul>
						<li>Conversation history and child sessions</li>
						<li>Running work, which will be stopped first</li>
					</ul>
					<div class="session-delete-dialog__warning">Workspace files are kept. This action cannot be undone.</div>
					<Show when={props.error}>
						<div class="session-delete-dialog__error">Delete failed: {props.error}</div>
					</Show>
				</div>

				<footer class="session-delete-dialog__footer">
					<button ref={cancelButton} class="session-delete-dialog__cancel" disabled={props.busy} onClick={props.onCancel}>Cancel</button>
					<button class="session-delete-dialog__confirm" disabled={props.busy} onClick={props.onConfirm}>
						<Show when={props.busy}><span class="tool-card__spinner" /></Show>
						{props.busy ? "Deleting…" : "Delete session"}
					</button>
				</footer>
			</section>
		</div>
	)
}
