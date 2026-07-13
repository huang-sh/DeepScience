import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import * as api from "../api";
import { activeSessionId, setActiveView } from "../store";
import type { SkillDetail, SkillListResponse, SkillSummary } from "../types";
import Markdown from "./Markdown";

type CategoryNode = SkillListResponse["categoryTree"][number];
type CategoryChild = CategoryNode["children"][number];
type SkillSourceFilter = SkillListResponse["sources"][number]["id"] | "";

function isCategoryNode(item: CategoryNode | CategoryChild): item is CategoryNode {
	return "children" in item && Array.isArray(item.children);
}

export default function SkillsView() {
	const [query, setQuery] = createSignal("");
	const [category, setCategory] = createSignal("");
	const [expandedCategory, setExpandedCategory] = createSignal("");
	const [source, setSource] = createSignal<SkillSourceFilter>("");
	const [skills, setSkills] = createSignal<SkillSummary[]>([]);
	const [categoryTree, setCategoryTree] = createSignal<SkillListResponse["categoryTree"]>([]);
	const [sources, setSources] = createSignal<SkillListResponse["sources"]>([]);
	const [total, setTotal] = createSignal(0);
	const [duplicates, setDuplicates] = createSignal(0);
	const [loaded, setLoaded] = createSignal<string[]>([]);
	const [diagnosticCount, setDiagnosticCount] = createSignal(0);
	const [selected, setSelected] = createSignal<SkillDetail | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [detailLoading, setDetailLoading] = createSignal(false);
	const [error, setError] = createSignal("");
	let listSequence = 0;

	const categoryLabel = (path: string): string => path.split("/").join(" › ");
	const expandedNode = (): CategoryNode | undefined =>
		categoryTree().find((item) => item.path === expandedCategory());

	const load = async (): Promise<void> => {
		const sequence = ++listSequence;
		setLoading(true);
		setError("");
		try {
			const queryText = query().trim();
			const categoryPath = category();
			const payload = await api.fetchSkills({
				query: queryText,
				category: categoryPath,
				source: source() || undefined,
				sessionId: activeSessionId() ?? undefined,
				directoryOnly: !queryText && !categoryPath,
			});
			if (sequence !== listSequence) return;
			setSkills(payload.skills);
			setCategoryTree(payload.categoryTree);
			setSources(payload.sources);
			setTotal(payload.total);
			setDuplicates(payload.duplicates);
			setLoaded(payload.loaded);
			if (expandedCategory() && !payload.categoryTree.some((item) => item.path === expandedCategory())) {
				setExpandedCategory("");
			}
		} catch (cause) {
			if (sequence === listSequence) setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			if (sequence === listSequence) setLoading(false);
		}
	};

	createEffect(() => {
		query();
		category();
		source();
		activeSessionId();
		const timer = setTimeout(() => void load(), 180);
		onCleanup(() => clearTimeout(timer));
	});

	createEffect(() => {
		void api
			.fetchSkillDiagnostics()
			.then((diagnostics) => setDiagnosticCount(diagnostics.length))
			.catch(() => setDiagnosticCount(0));
	});

	const openSkill = async (name: string): Promise<void> => {
		setDetailLoading(true);
		setError("");
		try {
			setSelected(await api.fetchSkill(name, activeSessionId() ?? undefined));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setDetailLoading(false);
		}
	};

	const refresh = async (): Promise<void> => {
		setLoading(true);
		setError("");
		try {
			const result = await api.refreshSkillCatalog();
			setDiagnosticCount(result.diagnostics);
			setDuplicates(result.duplicates);
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setLoading(false);
		}
	};

	const chooseTopCategory = (item: CategoryNode): void => {
		setQuery("");
		setSelected(null);
		setExpandedCategory(item.path);
		setCategory(item.children.length > 0 ? "" : item.path);
	};

	const chooseLeafCategory = (path: string): void => {
		setQuery("");
		setSelected(null);
		setCategory(path);
	};

	const changeCategory = (): void => {
		const root = categoryTree().find((item) => item.path === category().split("/")[0]);
		setSelected(null);
		setCategory("");
		setExpandedCategory(root?.children.length ? root.path : "");
	};

	const changeSource = (value: SkillSourceFilter): void => {
		setSource(value);
		setQuery("");
		setCategory("");
		setExpandedCategory("");
		setSelected(null);
	};

	return (
		<div class="skills-library">
			<header class="skills-library__header">
				<div>
					<button class="view-back" onClick={() => setActiveView("workspace")}>← Workspace</button>
					<h1 class="view-title">DeepScience Skill Library</h1>
					<p class="view-subtitle">
						Choose a scientific category first, then compare the complete Pi-style metadata for every skill in
						that category. Full instructions remain on demand.
					</p>
				</div>
				<button class="skills-refresh" disabled={loading()} onClick={() => void refresh()}>Refresh library</button>
			</header>

			<section class="skills-statusbar" aria-label="Skill library status">
				<div><strong>{total()}</strong><span>Available</span></div>
				<div><strong>{loaded().length}</strong><span>Loaded in session</span></div>
				<div><strong>{sources().length}</strong><span>Collections</span></div>
				<div><strong>{duplicates()}</strong><span>Duplicates removed</span></div>
				<div class={diagnosticCount() ? "has-warning" : ""}><strong>{diagnosticCount()}</strong><span>Diagnostics</span></div>
				<div class="skills-statusbar__session">
					{activeSessionId() ? `Session ${activeSessionId()}` : "Start a session to track loaded skills"}
				</div>
			</section>

			<div class="skills-sources" role="group" aria-label="Skill collections">
				<button class={!source() ? "is-active" : ""} onClick={() => changeSource("")}>
					All collections <span>{total()}</span>
				</button>
				<For each={sources()}>
					{(item) => (
						<button class={source() === item.id ? "is-active" : ""} onClick={() => changeSource(item.id)}>
							{item.label} <span>{item.count}</span>
						</button>
					)}
				</For>
			</div>

			<div class="skills-toolbar">
				<input
					class="skills-search"
					value={query()}
					onInput={(event) => {
						const value = event.currentTarget.value;
						setQuery(value);
						if (value.trim()) {
							setCategory("");
							setExpandedCategory("");
							setSelected(null);
						}
					}}
					placeholder="Manual search across names and descriptions…"
				/>
			</div>

			<Show when={error()}><div class="skills-error">{error()}</div></Show>

			<Show when={!query().trim()}>
				<section class={`skill-directory ${category() ? "has-selection" : ""}`} aria-label="Skill category directory">
					<header class="skill-directory__header">
						<div>
							<span>Stage 1 · Category directory</span>
							<h2>{category() ? categoryLabel(category()) : expandedNode() ? categoryLabel(expandedCategory()) : "Choose a domain"}</h2>
						</div>
						<Show when={category()}>
							<button onClick={changeCategory}>Change category</button>
						</Show>
						<Show when={!category() && expandedNode()}>
							<button onClick={() => setExpandedCategory("")}>← All domains</button>
						</Show>
					</header>

					<Show when={!category()}>
						<div class="skill-directory__grid">
							<For each={expandedNode()?.children ?? categoryTree()}>
								{(item) => (
									<button
										class="skill-directory__item"
										onClick={() => {
											if (expandedNode()) chooseLeafCategory(item.path);
											else if (isCategoryNode(item)) chooseTopCategory(item);
										}}
									>
										<span>{categoryLabel(item.path)}</span>
										<strong>{item.count}</strong>
										<small>{isCategoryNode(item) && item.children.length > 0 ? `${item.children.length} subcategories` : "View metadata"}</small>
									</button>
								)}
							</For>
						</div>
					</Show>
					<Show when={category()}>
						<p class="skill-directory__selection">
							The complete metadata set for <strong>{categoryLabel(category())}</strong> is shown below.
						</p>
					</Show>
				</section>
			</Show>

			<Show when={query().trim() || category()}>
				<div class={`skills-library__content ${selected() || detailLoading() ? "has-detail" : ""}`}>
					<section class="skills-results" aria-label="Skill metadata">
						<header class="skills-results__header">
							<div>
								<span>{query().trim() ? "Manual search" : "Stage 2 · Pi-style metadata"}</span>
								<h2>{query().trim() ? `Results for “${query().trim()}”` : categoryLabel(category())}</h2>
							</div>
							<strong>{skills().length} skills</strong>
						</header>
						<Show when={loading()}><div class="skills-empty">Loading skill metadata…</div></Show>
						<Show when={!loading() && skills().length === 0}><div class="skills-empty">No matching skills.</div></Show>
						<div class="skills-grid">
							<For each={skills()}>
								{(skill) => (
									<button
										class={`skill-card ${selected()?.name === skill.name ? "is-selected" : ""}`}
										onClick={() => void openSkill(skill.name)}
									>
										<div class="skill-card__head">
											<span class={`skill-card__dot source-${skill.source}`} aria-hidden="true" />
											<span class="skill-card__name">{skill.name}</span>
											<Show when={skill.loaded}><span class="skill-card__loaded">Loaded</span></Show>
										</div>
										<p class="skill-card__desc">{skill.description}</p>
										<div class="skill-card__path" title={skill.filePath}>{skill.filePath}</div>
										<div class="skill-card__meta"><span>{categoryLabel(skill.categoryPath.join("/"))}</span><span>{skill.sourceLabel}</span></div>
									</button>
								)}
							</For>
						</div>
					</section>

					<Show when={selected() || detailLoading()}>
						<aside class="skill-detail" aria-label="Skill details">
							<Show when={detailLoading()}><div class="skills-empty">Loading instructions…</div></Show>
							<Show when={!detailLoading() && selected()}>
								{(skill) => (
									<>
										<header class="skill-detail__header">
											<div>
												<div class="skill-detail__category">{categoryLabel(skill().categoryPath.join("/"))} · {skill().sourceLabel}</div>
												<h2>{skill().name}</h2>
											</div>
											<button onClick={() => setSelected(null)} aria-label="Close skill details">×</button>
										</header>
										<p class="skill-detail__description">{skill().description}</p>
										<dl class="skill-detail__metadata">
											<div><dt>Location</dt><dd title={skill().filePath}>{skill().filePath}</dd></div>
											<div><dt>Source</dt><dd>{skill().sourceLabel}</dd></div>
											<div><dt>Aliases</dt><dd>{skill().aliases.join(", ") || "None"}</dd></div>
											<div><dt>Invocation</dt><dd>{skill().disableModelInvocation ? "Manual only" : "Agent available"}</dd></div>
										</dl>
										<Show when={skill().loaded} fallback={<div class="skill-detail__state">Previewed on demand · not loaded into this session</div>}>
											<div class="skill-detail__state is-loaded">Loaded in current session</div>
										</Show>
										<div class="skill-detail__body"><Markdown text={skill().content} /></div>
									</>
								)}
							</Show>
						</aside>
					</Show>
				</div>
			</Show>
		</div>
	);
}
