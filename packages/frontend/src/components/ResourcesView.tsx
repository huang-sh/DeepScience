import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import * as api from "../api";
import { activeSessionId, setActiveView } from "../store";
import type { ResourceCatalogResponse, ResourceEntry } from "../types";

const EMPTY_STATS: ResourceCatalogResponse["stats"] = {
	entries: 0,
	uniqueDatabases: 0,
	referencedFiles: 0,
	localFiles: 0,
	missingFiles: 0,
	totalBytes: 0,
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`;
}

function searchableText(resource: ResourceEntry): string {
	return [
		resource.name,
		resource.dbName,
		resource.categoryPath.join(" "),
		resource.content.join(" "),
		resource.files.map((file) => file.path).join(" "),
	]
		.join(" ")
		.toLowerCase();
}

function resourceSummary(resource: ResourceEntry): string {
	if (resource.content.length) return resource.content.slice(0, 3).join(" · ");
	if (resource.accessMode === "remote") return "Live database access through a bounded remote API connector";
	if (resource.accessMode === "hybrid") return "Bundled data with optional live database access";
	const local = resource.files.filter((file) => file.exists).length;
	if (local) return `${local} local data file${local === 1 ? "" : "s"}`;
	return resource.categoryPath.join(" / ");
}

function accessLabel(resource: ResourceEntry): string {
	if (resource.accessMode === "remote") return "Remote API";
	if (resource.accessMode === "hybrid") return "Hybrid";
	return "Local";
}

function resourceFileLabel(resource: ResourceEntry): string {
	const available = resource.files.filter((file) => file.exists).length;
	if (resource.accessMode === "remote") return available ? `${available} docs` : "API only";
	return `${available}/${resource.files.length} files`;
}

export default function ResourcesView() {
	const [query, setQuery] = createSignal("");
	const [category, setCategory] = createSignal("");
	const [payload, setPayload] = createSignal<ResourceCatalogResponse | null>(null);
	const [selectedId, setSelectedId] = createSignal("");
	const [collapsedGroups, setCollapsedGroups] = createSignal<string[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal("");

	const resources = createMemo(() => payload()?.resources ?? []);
	const visibleResources = createMemo(() => {
		const needle = query().trim().toLowerCase();
		return resources().filter((resource) => {
			if (category() && resource.category !== category()) return false;
			return !needle || searchableText(resource).includes(needle);
		});
	});
	const selected = createMemo(() => resources().find((resource) => resource.id === selectedId()) ?? null);
	const groupedResources = createMemo(() => {
		const activeCategory = category();
		const groups = new Map<string, { key: string; label: string; resources: ResourceEntry[] }>();
		for (const resource of visibleResources()) {
			const label = activeCategory ? (resource.categoryPath[1] ?? resource.category) : resource.category;
			const key = activeCategory ? `${activeCategory}/${label}` : label;
			const group = groups.get(key) ?? { key, label, resources: [] };
			group.resources.push(resource);
			groups.set(key, group);
		}
		return [...groups.values()].map((group) => ({
			...group,
			resources: group.resources.sort((left, right) => left.name.localeCompare(right.name)),
		}));
	});

	const toggleGroup = (key: string): void => {
		setCollapsedGroups((current) =>
			current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
		);
	};

	const load = async (): Promise<void> => {
		setLoading(true);
		setError("");
		try {
			setPayload(await api.fetchResources(activeSessionId() ?? undefined));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setLoading(false);
		}
	};

	createEffect(() => {
		const visible = visibleResources();
		if (!selectedId() || visible.some((resource) => resource.id === selectedId())) return;
		setSelectedId("");
	});

	createEffect(() => {
		activeSessionId();
		const timer = setTimeout(() => void load(), 80);
		onCleanup(() => clearTimeout(timer));
	});

	onMount(() => {
		const closeDetail = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setSelectedId("");
		};
		window.addEventListener("keydown", closeDetail);
		onCleanup(() => window.removeEventListener("keydown", closeDetail));
	});

	return (
		<div class="skills-library resource-library">
			<header class="skills-library__header">
				<div>
					<button class="view-back" onClick={() => setActiveView("workspace")}>← Workspace</button>
					<h1 class="view-title">DeepScience Resource Library</h1>
					<p class="view-subtitle">
						Curated local datasets and on-demand database connectors for genome, RNA regulation, proteins, metabolism, pathways,
						cellular systems, phenotypes, and therapeutic targets.
					</p>
				</div>
				<button class="skills-refresh" disabled={loading()} onClick={() => void load()}>Refresh catalog</button>
			</header>

			<section class="skills-statusbar" aria-label="Resource library status">
				<div><strong>{payload()?.stats.uniqueDatabases ?? EMPTY_STATS.uniqueDatabases}</strong><span>Databases</span></div>
				<div><strong>{payload()?.stats.entries ?? EMPTY_STATS.entries}</strong><span>Catalog entries</span></div>
				<div><strong>{payload()?.loaded.length ?? 0}</strong><span>Loaded in session</span></div>
				<div><strong>{formatBytes(payload()?.stats.totalBytes ?? EMPTY_STATS.totalBytes)}</strong><span>On disk</span></div>
				<div class={`skills-statusbar__session ${(payload()?.stats.missingFiles ?? 0) > 0 ? "has-warning" : ""}`}>
					{payload()?.stats.missingFiles ? `${payload()?.stats.missingFiles} indexed files missing` : "Local catalog ready"}
				</div>
			</section>

			<div class="skills-sources" role="group" aria-label="Resource categories">
				<button class={!category() ? "is-active" : ""} onClick={() => setCategory("")}>
					All categories <span>{payload()?.stats.entries ?? 0}</span>
				</button>
				<For each={payload()?.categories ?? []}>
					{(item) => (
						<button class={category() === item.name ? "is-active" : ""} onClick={() => setCategory(item.name)}>
							{item.name} <span>{item.count}</span>
						</button>
					)}
				</For>
			</div>

			<div class="skills-toolbar">
				<input
					class="skills-search"
					value={query()}
					onInput={(event) => setQuery(event.currentTarget.value)}
					placeholder="Search databases, categories, content, or filenames…"
				/>
			</div>

			<Show when={error()}><div class="skills-error">{error()}</div></Show>

			<div class="resource-catalog">
				<section class="resource-catalog__results" aria-label="Scientific resources">
					<header class="skills-results__header">
						<div><span>Resource catalog</span><h2>{category() || "All resources"}</h2></div>
						<strong>{visibleResources().length} shown</strong>
					</header>
					<Show when={loading()}><div class="skills-empty">Loading database catalog…</div></Show>
					<Show when={!loading() && visibleResources().length === 0}>
						<div class="skills-empty">No matching database resources.</div>
					</Show>
					<div class="resource-groups">
						<For each={groupedResources()}>
							{(group) => {
								const collapsed = () => collapsedGroups().includes(group.key);
								return (
									<section class={`resource-group ${collapsed() ? "is-collapsed" : ""}`}>
										<button
											class="resource-group__header"
											onClick={() => toggleGroup(group.key)}
											aria-expanded={!collapsed()}
										>
											<span class="resource-group__chevron" aria-hidden="true">⌄</span>
											<strong>{group.label}</strong>
											<span>{group.resources.length}</span>
										</button>
										<Show when={!collapsed()}>
											<div class="resource-table" role="table" aria-label={`${group.label} resources`}>
												<div class="resource-table__columns" role="row">
													<span role="columnheader">Resource</span>
													<span role="columnheader">Domain</span>
													<span role="columnheader">Access</span>
													<span role="columnheader">Files</span>
													<span role="columnheader">Session</span>
													<span aria-hidden="true" />
												</div>
												<For each={group.resources}>
													{(resource) => (
														<button
															class={`resource-row ${selectedId() === resource.id ? "is-selected" : ""}`}
															onClick={() => setSelectedId(resource.id)}
															role="row"
														>
															<span class="resource-row__identity" role="cell">
																<span class="skill-card__dot source-deepscience" aria-hidden="true" />
																<span>
																	<strong>{resource.name}</strong>
																	<small>{resourceSummary(resource)}</small>
																</span>
															</span>
															<span class="resource-row__domain" role="cell">{resource.categoryPath.slice(1).join(" › ") || resource.category}</span>
															<span role="cell"><span class={`resource-access is-${resource.accessMode}`}>{accessLabel(resource)}</span></span>
															<span class="resource-row__files" role="cell">{resourceFileLabel(resource)}</span>
															<span class={`resource-row__session ${resource.loaded ? "is-loaded" : ""}`} role="cell">{resource.loaded ? "Loaded" : "Available"}</span>
															<span class="resource-row__open" aria-hidden="true">›</span>
														</button>
													)}
												</For>
											</div>
										</Show>
									</section>
								);
							}}
						</For>
					</div>
				</section>

				<Show when={selected()}>
					{(resource) => (
						<aside class="skill-detail resource-detail resource-detail-drawer" aria-label="Resource details">
							<header class="skill-detail__header">
								<div>
									<div class="skill-detail__category">Scientific database · {resource().category}</div>
									<h2>{resource().name}</h2>
								</div>
								<button onClick={() => setSelectedId("")} aria-label="Close resource details">×</button>
							</header>
							<p class="skill-detail__description">{resourceSummary(resource())}</p>
							<dl class="skill-detail__metadata">
								<div><dt>Database</dt><dd>{resource().dbName}</dd></div>
								<div><dt>Category</dt><dd>{resource().categoryPath.join(" › ")}</dd></div>
								<div><dt>Access</dt><dd>{resource().accessMode === "remote" ? "Remote API (on demand)" : resource().accessMode}</dd></div>
								<div>
									<dt>Files</dt>
									<dd>
										{resource().accessMode === "remote"
											? `${resource().files.filter((file) => file.exists).length} bundled support files`
											: `${resource().files.filter((file) => file.exists).length} local / ${resource().files.length} indexed`}
									</dd>
								</div>
							</dl>
							<div class={`skill-detail__state ${resource().loaded ? "is-loaded" : ""}`}>
								{resource().loaded
									? "Loaded through the resource tool in the current session"
									: "Available on demand through the separate resource tool"}
							</div>
							<div class="skill-detail__body resource-detail__body">
								<Show when={resource().content.length > 0}>
									<section class="resource-detail__section">
										<h3>Contents</h3>
										<div class="resource-detail__chips"><For each={resource().content}>{(item) => <span>{item}</span>}</For></div>
									</section>
								</Show>
								<Show when={resource().files.length > 0}>
									<section class="resource-detail__section">
										<h3>{resource().accessMode === "remote" ? "Bundled documentation" : "Local data files"}</h3>
										<div class="resource-detail__files">
											<For each={resource().files}>
												{(file) => (
													<Show when={file.exists} fallback={<div class="resource-file is-missing"><code>{file.path}</code><span>Missing</span></div>}>
														<a class="resource-file" href={api.resourceFileRawUrl(file.path)} target="_blank" rel="noopener">
															<code>{file.path.replace(/^resource\//, "")}</code><span>{formatBytes(file.size)} ↗</span>
														</a>
													</Show>
												)}
											</For>
										</div>
									</section>
								</Show>
								<Show when={resource().url || resource().citation}>
									<section class="resource-detail__section">
										<h3>Reference</h3>
										<Show when={resource().url}>
											<a class="resource-detail__link" href={resource().url} target="_blank" rel="noopener">Open database website ↗</a>
										</Show>
										<Show when={resource().citation}><p class="resource-detail__citation">{resource().citation}</p></Show>
									</section>
								</Show>
							</div>
						</aside>
					)}
				</Show>
			</div>
		</div>
	);
}
