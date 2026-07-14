/* ================================================================
   DeepScience frontend — central state store

   Signals for: agents, models, sessions, messages, timeline,
   streaming, connection, panel widths/collapse.
   ================================================================ */

import { batch, createSignal } from "solid-js";
import * as api from "./api";
import { readArtifactPublication } from "./presentation/artifact-registry";
import { summarizeContent } from "./result";
import type {
	AgentInfo,
	Capabilities,
	CapabilityFeatures,
	CapabilitySettings,
	ChatMessage,
	ConnectionState,
	DeepSciencePreferences,
	HistoryPart,
	MessagePart,
	ModelRef,
	SessionInfo,
	SettingsPanelSupport,
	SSEEvent,
	ThinkingLevel,
	ToolResultContent,
	TraceEntry,
	WorkspaceFileEntry,
	WorkspaceFilePreview,
	WorkspaceProject,
	WorkspaceSelection,
} from "./types";

let msgCounter = 0;
function nextId(): string {
	return `m${Date.now()}_${msgCounter++}`;
}

/* ── Reactive state ─────────────────────────────────────────────── */

const FALLBACK_CAPABILITIES: Capabilities = {
	brand: "DeepScience",
	version: "0.0.2",
	features: {
		sessions: true,
		agents: true,
		models: true,
		scienceArtifacts: true,
		researchGraph: false,
		fileBrowsing: true,
		projectWorkspaces: true,
		gitWorktrees: true,
		account: false,
		managedBilling: false,
		wallet: false,
		providerOAuth: false,
		mcpManagement: false,
		pty: false,
		lsp: false,
		formatter: false,
	},
	settings: {
		capabilities: true,
		skills: true,
		specialists: false,
		memory: false,
		compute: false,
		"local-models": false,
		permissions: false,
		sandbox: false,
		credentials: false,
		storage: false,
		general: "appearance-only",
	},
};

const [capabilities, setCapabilities] = createSignal<Capabilities>(FALLBACK_CAPABILITIES);
const [agents, setAgents] = createSignal<AgentInfo[]>([]);
const [models, setModels] = createSignal<Record<string, ModelRef[]>>({});
const [selectedAgent, setSelectedAgentSignal] = createSignal("biology");
let preferredAgent = "biology";

const [session, setSession] = createSignal<SessionInfo | null>(null);
const [messages, setMessages] = createSignal<ChatMessage[]>([]);
const [timeline, setTimeline] = createSignal<TraceEntry[]>([]);
const [sessionList, setSessionList] = createSignal<SessionInfo[]>([]);
const [activeSessionId, setActiveSessionId] = createSignal<string | null>(null);

const sessionMessages = new Map<string, ChatMessage[]>();
const sessionTimelines = new Map<string, TraceEntry[]>();
const sessionRunStatus = new Map<string, string>();
const sessionRuns = new Map<string, AbortController>();

const [streaming, setStreaming] = createSignal(false);
const [connState, setConnState] = createSignal<ConnectionState>("connecting");
const [composerStatus, setComposerStatus] = createSignal("");

const [selectedModel, setSelectedModelSignal] = createSignal<ModelRef | null>(null);
let preferredModel: ModelRef | null = null;
const [selectedThinkingLevel, setSelectedThinkingLevelSignal] = createSignal<ThinkingLevel>("medium");
let preferredThinkingLevel: ThinkingLevel = "medium";

function updateSessionMessages(sessionId: string, update: (current: ChatMessage[]) => ChatMessage[]): void {
	const current = activeSessionId() === sessionId ? messages() : (sessionMessages.get(sessionId) ?? []);
	const next = update(current);
	sessionMessages.set(sessionId, next);
	if (activeSessionId() === sessionId) setMessages(next);
}

function updateSessionTimeline(sessionId: string, update: (current: TraceEntry[]) => TraceEntry[]): void {
	const current = activeSessionId() === sessionId ? timeline() : (sessionTimelines.get(sessionId) ?? []);
	const next = update(current);
	sessionTimelines.set(sessionId, next);
	if (activeSessionId() === sessionId) setTimeline(next);
}

function setSessionRunStatus(sessionId: string, status: string): void {
	sessionRunStatus.set(sessionId, status);
	if (activeSessionId() === sessionId) setComposerStatus(status);
}

function cacheActiveSessionView(): void {
	const id = activeSessionId();
	if (!id) return;
	sessionMessages.set(id, messages());
	sessionTimelines.set(id, timeline());
}

/* ── Panel state ────────────────────────────────────────────────── */

const [leftWidth, setLeftWidth] = createSignal(280);
const [rightWidth, setRightWidth] = createSignal(300);
const [leftCollapsed, setLeftCollapsed] = createSignal(false);
const [rightCollapsed, setRightCollapsed] = createSignal(false);
const [activeLeftTab, setActiveLeftTab] = createSignal<"tasks" | "files">("tasks");
const [activeTraceView, setActiveTraceView] = createSignal<"tools" | "artifacts" | "summary">("tools");
const [workspaceSelection, setWorkspaceSelection] = createSignal<WorkspaceSelection | null>(null);
const [workspaceProjects, setWorkspaceProjects] = createSignal<WorkspaceProject[]>([]);

const WORKSPACE_DIRECTORY_KEY = "deepscience.workspace.directory";

async function loadInitialWorkspace(): Promise<WorkspaceSelection> {
	const current = await api.fetchCurrentProject();
	if (typeof localStorage !== "undefined") localStorage.setItem(WORKSPACE_DIRECTORY_KEY, current.directory);
	return current;
}

/* ── Derived ────────────────────────────────────────────────────── */

export function flatModels(): ModelRef[] {
	const grouped = models();
	const result: ModelRef[] = [];
	for (const [provider, list] of Object.entries(grouped)) {
		for (const m of list) {
			result.push({ ...m, provider });
		}
	}
	return result;
}

/* ── Initialization ─────────────────────────────────────────────── */

export async function init(): Promise<void> {
	setConnState("connecting");
	try {
		const initialWorkspace = await loadInitialWorkspace();
		const [agentList, modelMap, sessList, caps, preferences] = await Promise.all([
			api.fetchAgents(),
			api.fetchModels(),
			api.fetchSessions(initialWorkspace.directory),
			api.fetchCapabilities().catch(() => null),
			api.fetchPreferences().catch((): DeepSciencePreferences => ({})),
		]);
		batch(() => {
			setAgents(agentList);
			setModels(modelMap);
			if (sessList) setSessionList(sessList);
			if (caps) setCapabilities(mergeCapabilities(caps));
			setWorkspaceSelection(initialWorkspace);

			const storedAgent = agentList.find((agent) => agent.name === preferences.defaultAgent)?.name;
			const initialAgent = storedAgent ?? agentList[0]?.name ?? "biology";
			setSelectedAgentSignal(initialAgent);
			preferredAgent = initialAgent;

			const all = Object.entries(modelMap).flatMap(([provider, list]) =>
				list.map((model) => ({ ...model, provider })),
			);
			const storedModel = preferences.defaultModel
				? all.find(
						(model) =>
							model.provider === preferences.defaultModel?.provider && model.id === preferences.defaultModel.id,
					)
				: undefined;
			const initialModel = storedModel ?? all[0] ?? null;
			setSelectedModelSignal(initialModel);
			preferredModel = initialModel;
			const initialThinkingLevel: ThinkingLevel = initialModel?.thinkingLevels?.includes("medium")
				? "medium"
				: "off";
			setSelectedThinkingLevelSignal(initialThinkingLevel);
			preferredThinkingLevel = initialThinkingLevel;

			setConnState("connected");
			setComposerStatus("Ready");
		});
		void refreshWorkspaceProjects();
	} catch {
		setConnState("disconnected");
		setComposerStatus("Connection failed");
	}
}

function setSelectedAgent(name: string): void {
	preferredAgent = name;
	setSelectedAgentSignal(name);
	void api.updatePreferences({ defaultAgent: name }).catch(() => {
		setComposerStatus("Failed to save agent preference");
	});
}

function setSelectedModel(model: ModelRef): void {
	preferredModel = model;
	setSelectedModelSignal(model);
	const availableThinking = model.thinkingLevels ?? ["off"];
	if (!availableThinking.includes(selectedThinkingLevel())) {
		preferredThinkingLevel = "off";
		setSelectedThinkingLevelSignal("off");
	}
	void api.updatePreferences({ defaultModel: model }).catch(() => {
		setComposerStatus("Failed to save model preference");
	});

	const current = session();
	if (!current || (current.model.provider === model.provider && current.model.id === model.id)) return;
	void api
		.updateSessionModel(current.id, model)
		.then((updated) => {
			if (session()?.id === updated.id) setSession(updated);
		})
		.catch((error) => {
			setComposerStatus(error instanceof Error ? error.message : "Failed to update the active session model");
		});
}

function setSelectedThinkingLevel(level: ThinkingLevel): void {
	const available = selectedModel()?.thinkingLevels ?? ["off"];
	if (!available.includes(level)) return;
	preferredThinkingLevel = level;
	setSelectedThinkingLevelSignal(level);
	const current = session();
	if (!current || current.thinkingLevel === level) return;
	void api
		.updateSessionThinkingLevel(current.id, level)
		.then((updated) => {
			if (session()?.id === updated.id) setSession(updated);
		})
		.catch(() => setComposerStatus("Failed to update reasoning level"));
}

export async function refreshModels(): Promise<void> {
	const modelMap = await api.fetchModels();
	setModels(modelMap);
	const available = Object.entries(modelMap).flatMap(([provider, list]) =>
		list.map((model) => ({ ...model, provider })),
	);
	const current = selectedModel();
	const retained = current
		? available.find((model) => model.provider === current.provider && model.id === current.id)
		: undefined;
	if (retained) return;
	const fallback = available[0] ?? null;
	preferredModel = fallback;
	setSelectedModelSignal(fallback);
	if (fallback) setSelectedModel(fallback);
}

function mergeCapabilities(partial: Partial<Capabilities>): Capabilities {
	return {
		brand: partial.brand || FALLBACK_CAPABILITIES.brand,
		version: partial.version || FALLBACK_CAPABILITIES.version,
		features: { ...FALLBACK_CAPABILITIES.features, ...partial.features },
		settings: { ...FALLBACK_CAPABILITIES.settings, ...partial.settings },
	};
}

function featureEnabled(key: keyof CapabilityFeatures): boolean {
	return capabilities().features[key] === true;
}

function settingsPanelVisible(key: keyof CapabilitySettings): boolean {
	const value = capabilities().settings[key];
	return value === true || value === "appearance-only";
}

function settingsPanelSupport(key: keyof CapabilitySettings): SettingsPanelSupport {
	return capabilities().settings[key];
}

/* ── Session lifecycle ──────────────────────────────────────────── */

async function ensureSession(): Promise<SessionInfo> {
	const current = session();
	if (current) return current;

	const created = await api.createSession(
		selectedAgent(),
		selectedModel() ?? undefined,
		workspaceSelection()?.directory,
		selectedThinkingLevel(),
	);
	setSession(created);
	setSelectedThinkingLevelSignal(created.thinkingLevel ?? "off");
	setActiveSessionId(created.id);
	void refreshSessions();
	return created;
}

/* ── Sending messages ───────────────────────────────────────────── */

export async function sendMessage(text: string): Promise<void> {
	const trimmed = text.trim();
	if (!trimmed || streaming()) return;

	const userMsg: ChatMessage = {
		id: nextId(),
		role: "user",
		parts: [{ kind: "text", text: trimmed }],
		timestamp: Date.now(),
	};

	const assistantId = nextId();
	const assistantMsg: ChatMessage = {
		id: assistantId,
		role: "assistant",
		parts: [],
		streaming: true,
		timestamp: Date.now(),
	};

	batch(() => {
		setMessages((prev) => [...prev, userMsg, assistantMsg]);
		setStreaming(true);
		setComposerStatus("Sending…");
	});

	let currentSession: SessionInfo;
	try {
		currentSession = await ensureSession();
	} catch (err) {
		pushError(undefined, assistantId, err);
		return;
	}

	sessionMessages.set(currentSession.id, messages());
	const controller = api.streamMessage(
		currentSession.id,
		trimmed,
		(event) => handleSSE(currentSession.id, assistantId, event),
		(err) => pushError(currentSession.id, assistantId, err),
		() => finishStreaming(currentSession.id, assistantId),
	);
	sessionRuns.set(currentSession.id, controller);
	sessionRunStatus.set(currentSession.id, "Sending…");
}

function handleSSE(sessionId: string, assistantId: string, event: SSEEvent): void {
	switch (event.type) {
		case "turn_start":
			setSessionRunStatus(sessionId, "Considering next steps…");
			break;
		case "text_delta":
			appendText(sessionId, assistantId, event.turnIndex, event.contentIndex, event.delta, event.phase);
			setSessionRunStatus(sessionId, event.phase === "final" ? "Writing response…" : "Working…");
			break;
		case "thinking_delta":
			appendThinking(sessionId, assistantId, event.turnIndex, event.contentIndex, event.delta, event.redacted);
			setSessionRunStatus(sessionId, "Thinking…");
			break;
		case "assistant_end":
			finalizeAssistantTurn(sessionId, assistantId, event.turnIndex, event.stopReason);
			break;
		case "tool_start":
			addToolStart(sessionId, assistantId, event.turnIndex, event.callId, event.tool, event.args);
			addTraceEntry(sessionId, event.callId, event.tool, "running");
			setSessionRunStatus(sessionId, `Running ${event.tool}…`);
			break;
		case "tool_update":
			updateToolProgress(sessionId, assistantId, event.callId, event.content, event.output, event.details);
			updateTraceEntry(sessionId, event.callId, event.tool, "running", event.output?.slice(0, 120));
			break;
		case "tool_end":
			updateToolEnd(sessionId, assistantId, event.callId, event.content, event.output, event.isError, event.details);
			updateTraceEntry(
				sessionId,
				event.callId,
				event.tool,
				event.isError ? "error" : "done",
				event.output?.slice(0, 120),
			);
			if (readArtifactPublication(event.details) && !event.isError && activeSessionId() === sessionId) {
				setActiveTraceView("artifacts");
				setRightCollapsed(false);
			}
			break;
		case "error":
			pushError(sessionId, assistantId, new Error(event.message));
			break;
		case "done":
			finishStreaming(sessionId, assistantId);
			break;
		case "turn_end":
		case "agent_end":
			break;
	}
}

/* ── Message mutation helpers ───────────────────────────────────── */

function appendText(
	sessionId: string,
	assistantId: string,
	turnIndex: number,
	contentIndex: number,
	delta: string,
	phase: "pending" | "process" | "final",
): void {
	const id = `text:${turnIndex}:${contentIndex}`;
	updateSessionMessages(sessionId, (prev) =>
		prev.map((msg) => {
			if (msg.id !== assistantId) return msg;
			const existing = msg.parts.findIndex((part) => part.kind === "text" && part.id === id);
			const parts = [...msg.parts];
			if (existing >= 0) {
				const current = parts[existing];
				if (current.kind === "text")
					parts[existing] = { ...current, text: current.text + delta, phase, streaming: true };
			} else parts.push({ kind: "text", id, text: delta, turnIndex, phase, streaming: true });
			return { ...msg, parts };
		}),
	);
}

function appendThinking(
	sessionId: string,
	assistantId: string,
	turnIndex: number,
	contentIndex: number,
	delta: string,
	redacted: boolean,
): void {
	const id = `thinking:${turnIndex}:${contentIndex}`;
	updateSessionMessages(sessionId, (previous) =>
		previous.map((message) => {
			if (message.id !== assistantId) return message;
			const existing = message.parts.findIndex((part) => part.kind === "thinking" && part.id === id);
			const parts = [...message.parts];
			if (existing >= 0) {
				const current = parts[existing];
				if (current.kind === "thinking")
					parts[existing] = { ...current, text: current.text + delta, redacted, streaming: true };
			} else parts.push({ kind: "thinking", id, text: delta, turnIndex, redacted, streaming: true });
			return { ...message, parts };
		}),
	);
}

function finalizeAssistantTurn(sessionId: string, assistantId: string, turnIndex: number, stopReason: string): void {
	const terminal = stopReason === "stop" || stopReason === "length";
	updateSessionMessages(sessionId, (previous) =>
		previous.map((message) =>
			message.id !== assistantId
				? message
				: {
						...message,
						parts: message.parts.map((part) => {
							if (part.kind === "thinking" && part.turnIndex === turnIndex) return { ...part, streaming: false };
							if (part.kind !== "text" || part.turnIndex !== turnIndex) return part;
							return {
								...part,
								streaming: false,
								phase:
									part.phase === "pending"
										? terminal
											? ("final" as const)
											: ("process" as const)
										: part.phase,
							};
						}),
					},
		),
	);
}

function addToolStart(
	sessionId: string,
	assistantId: string,
	turnIndex: number,
	callId: string,
	tool: string,
	args: Record<string, unknown>,
): void {
	updateSessionMessages(sessionId, (prev) =>
		prev.map((msg) => {
			if (msg.id !== assistantId) return msg;
			const parts: MessagePart[] = [
				...msg.parts,
				{
					kind: "tool",
					id: callId,
					tool,
					args,
					turnIndex,
					status: "running" as const,
				},
			];
			return { ...msg, parts };
		}),
	);
}

function updateToolProgress(
	sessionId: string,
	assistantId: string,
	callId: string,
	content: ToolResultContent[] | undefined,
	output: string,
	details?: Record<string, unknown>,
): void {
	updateSessionMessages(sessionId, (previous) =>
		previous.map((message) =>
			message.id !== assistantId
				? message
				: {
						...message,
						parts: message.parts.map((part) =>
							part.kind === "tool" && part.id === callId ? { ...part, content, output, details } : part,
						),
					},
		),
	);
}

function updateToolEnd(
	sessionId: string,
	assistantId: string,
	callId: string,
	content: ToolResultContent[] | undefined,
	output: string,
	isError?: boolean,
	details?: Record<string, unknown>,
): void {
	updateSessionMessages(sessionId, (prev) =>
		prev.map((msg) => {
			if (msg.id !== assistantId) return msg;
			return {
				...msg,
				parts: msg.parts.map((p) =>
					p.kind === "tool" && p.id === callId
						? {
								...p,
								content,
								output,
								details,
								status: (isError ? "error" : "done") as "error" | "done",
							}
						: p,
				),
			};
		}),
	);
}

function pushError(sessionId: string | undefined, assistantId: string, err: unknown): void {
	const message = err instanceof Error ? err.message : String(err);
	const update = (prev: ChatMessage[]) =>
		prev.map((msg) =>
			msg.id === assistantId
				? {
						...msg,
						role: "error" as const,
						parts: [{ kind: "text" as const, text: message }],
						streaming: false,
					}
				: msg,
		);
	if (sessionId) {
		updateSessionMessages(sessionId, update);
		sessionRuns.delete(sessionId);
		sessionRunStatus.set(sessionId, `Error: ${message}`);
		if (activeSessionId() === sessionId) {
			setStreaming(false);
			setComposerStatus(`Error: ${message}`);
		}
	} else {
		setMessages(update);
		setStreaming(false);
		setComposerStatus(`Error: ${message}`);
	}
}

function finishStreaming(sessionId: string, assistantId: string): void {
	updateSessionMessages(sessionId, (prev) =>
		prev.map((msg) => {
			if (msg.id !== assistantId) return msg;
			return {
				...msg,
				streaming: false,
				parts: msg.parts.map((p) =>
					p.kind === "tool" && p.status === "running" ? { ...p, status: "done" as const } : p,
				),
			};
		}),
	);
	sessionRuns.delete(sessionId);
	sessionRunStatus.delete(sessionId);
	if (activeSessionId() === sessionId) {
		setStreaming(false);
		setComposerStatus("Ready");
	}
	void refreshSessions();
	if (activeSessionId() === sessionId && activeLeftTab() === "files") void loadWorkspaceFiles(workspacePath(), true);
}

/* ── Timeline (trace) management ────────────────────────────────── */

function addTraceEntry(sessionId: string, callId: string, tool: string, status: TraceEntry["status"]): void {
	updateSessionTimeline(sessionId, (prev) => [...prev, { id: callId, tool, status, timestamp: Date.now() }]);
}

function updateTraceEntry(
	sessionId: string,
	callId: string,
	tool: string,
	status: TraceEntry["status"],
	detail?: string,
): void {
	updateSessionTimeline(sessionId, (prev) =>
		prev.map((entry) => (entry.id === callId ? { ...entry, tool, status, detail } : entry)),
	);
}

/* ── Abort / new chat ───────────────────────────────────────────── */

export async function abortStream(updateUi = true): Promise<void> {
	const sessionID = activeSessionId();
	if (!sessionID || !sessionRuns.has(sessionID)) return;
	sessionRuns.get(sessionID)?.abort();
	sessionRuns.delete(sessionID);
	if (updateUi) setComposerStatus("Stopping…");
	try {
		if (sessionID) await api.abortSession(sessionID);
	} finally {
		if (updateUi) {
			updateSessionMessages(sessionID, (previous) =>
				previous.map((message) => ({
					...message,
					streaming: false,
					parts: message.parts.map((part) =>
						part.kind === "tool" && part.status === "running"
							? { ...part, status: "stopped" as const, output: part.output ?? "Stopped by user." }
							: part.kind === "thinking" || part.kind === "text"
								? { ...part, streaming: false }
								: part,
					),
				})),
			);
			updateSessionTimeline(sessionID, (previous) =>
				previous.map((entry) =>
					entry.status === "running" ? { ...entry, status: "stopped" as const, detail: "Stopped by user" } : entry,
				),
			);
			sessionRunStatus.delete(sessionID);
			if (activeSessionId() === sessionID) {
				setStreaming(false);
				setComposerStatus("Stopped");
			}
		}
	}
}

export function newChat(): void {
	cacheActiveSessionView();
	try {
		batch(() => {
			setSession(null);
			setActiveSessionId(null);
			setMessages([]);
			setTimeline([]);
			setStreaming(false);
			setSelectedAgentSignal(preferredAgent);
			setSelectedModelSignal(preferredModel);
			setSelectedThinkingLevelSignal(preferredThinkingLevel);
			setComposerStatus("Ready");
			closeArtifact();
			closeWorkspaceFile();
			setActiveView("workspace");
			setActiveLeftTab("tasks");
		});
	} catch (error) {
		// Translation/password-manager extensions can move injected frame nodes
		// while Solid is replacing the current transcript. The state reset above
		// is already complete; do not let that external DOM race cancel New task.
		if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
	}
}

export async function refreshWorkspaceProjects(): Promise<void> {
	setWorkspaceProjects(await api.fetchProjects());
}

export async function selectWorkspace(directory: string, create = false): Promise<void> {
	if (streaming()) throw new Error("Stop the running task before changing workspace.");
	const selected = await api.openWorkspace(directory, create);
	newChat();
	setWorkspaceSelection(selected);
	if (typeof localStorage !== "undefined") localStorage.setItem(WORKSPACE_DIRECTORY_KEY, selected.directory);
	await refreshWorkspaceProjects();
	await refreshSessions();
	if (activeLeftTab() === "files") await loadWorkspaceFiles("", true);
}

/* ── Session list (sidebar) ─────────────────────────────────────── */

export async function refreshSessions(): Promise<void> {
	try {
		const list = await api.fetchSessions(workspaceSelection()?.directory);
		setSessionList(list);
	} catch {
		/* ignore */
	}
}

export async function deleteSession(id: string): Promise<void> {
	await api.deleteSession(id);
	sessionRuns.get(id)?.abort();
	sessionRuns.delete(id);
	sessionRunStatus.delete(id);
	sessionMessages.delete(id);
	sessionTimelines.delete(id);
	setSessionList((current) => current.filter((item) => item.id !== id));

	if (activeSessionId() === id) {
		batch(() => {
			setSession(null);
			setActiveSessionId(null);
			setMessages([]);
			setTimeline([]);
			setStreaming(false);
			setComposerStatus("Session deleted");
		});
		closeArtifact();
		closeWorkspaceFile();
	}

	await refreshSessions();
}

export async function forkSession(id: string, messageId?: string): Promise<SessionInfo> {
	cacheActiveSessionView();
	const forked = await api.forkSession(id, messageId);
	setSessionList((current) => [forked, ...current.filter((item) => item.id !== forked.id)]);
	await loadSession(forked.id);
	void refreshSessions();
	return forked;
}

/** Load a past session's messages into the chat view. */
export async function loadSession(id: string): Promise<void> {
	const info = sessionList().find((s) => s.id === id);
	if (!info) return;
	cacheActiveSessionView();
	setSession(info);
	setSelectedAgentSignal(info.agentName);
	setSelectedModelSignal(info.model);
	setSelectedThinkingLevelSignal(info.thinkingLevel ?? "off");
	setActiveSessionId(id);
	setMessages(sessionMessages.get(id) ?? []);
	setTimeline(sessionTimelines.get(id) ?? []);
	const running = sessionRuns.has(id);
	setStreaming(running);
	setComposerStatus(running ? (sessionRunStatus.get(id) ?? "Working…") : `Loaded: ${info.title}`);
	closeArtifact();
	closeWorkspaceFile();
	if (activeLeftTab() === "files") void loadWorkspaceFiles("", true);
	if (running && sessionMessages.has(id)) return;

	try {
		const history = await api.fetchMessages(id);
		const chatMsgs: ChatMessage[] = [];
		let activeAssistant: ChatMessage | undefined;
		for (let i = 0; i < history.length; i++) {
			const msg = history[i];
			const role = msg.info?.role;
			const timestamp = msg.info?.time?.created ?? Date.now();
			if (role === "user") {
				const parts = (msg.parts ?? [])
					.filter((part) => part.type === "text" && Boolean(part.text))
					.map((part) => ({ kind: "text" as const, id: part.id, text: part.text ?? "" }));
				if (parts.length > 0)
					chatMsgs.push({ id: msg.info?.id ?? `hist_user_${i}`, role: "user", parts, timestamp });
				activeAssistant = undefined;
				continue;
			}

			if (!activeAssistant) {
				activeAssistant = {
					id: `hist_turn_${msg.info?.id ?? i}`,
					role: "assistant",
					parts: [],
					timestamp,
				};
				chatMsgs.push(activeAssistant);
			}

			if (role === "tool") {
				const toolPart = msg.parts?.find((p: HistoryPart) => p.type === "tool");
				if (!toolPart) continue;
				const content: ToolResultContent[] | undefined =
					toolPart.content && toolPart.content.length > 0 ? toolPart.content : undefined;
				activeAssistant.parts.push({
					kind: "tool",
					id: toolPart.callId ?? toolPart.id ?? `hist_${i}`,
					tool: toolPart.tool ?? "unknown",
					callId: toolPart.callId ?? "",
					content,
					details: toolPart.details,
					output: toolPart.output ?? summarizeContent(content),
					status: toolPart.state?.status === "error" ? "error" : "done",
				});
				continue;
			}

			for (const part of msg.parts ?? []) {
				if (part.type === "thinking") {
					activeAssistant.parts.push({
						kind: "thinking",
						id: part.id ?? `hist_thinking_${i}`,
						text: part.text ?? "",
						turnIndex: i,
						redacted: part.redacted,
					});
				} else if (part.type === "text" && part.text) {
					activeAssistant.parts.push({
						kind: "text",
						id: part.id ?? `hist_text_${i}`,
						text: part.text,
						turnIndex: i,
						phase: part.phase ?? "process",
					});
				}
			}
		}
		const visibleMessages = chatMsgs.filter((message) => message.role === "user" || message.parts.length > 0);
		sessionMessages.set(id, visibleMessages);
		if (activeSessionId() === id) {
			setMessages(visibleMessages);
			setComposerStatus("Ready");
		}
	} catch (error) {
		if (activeSessionId() === id) {
			setComposerStatus(error instanceof Error ? error.message : "Failed to load messages");
		}
	}
}

/* ── Settings modal ─────────────────────────────────────────────── */

const [settingsOpen, setSettingsOpen] = createSignal(false);

/* ── Theme ──────────────────────────────────────────────────────── */

export type ThemeId = "teal" | "light";

export interface ThemeMeta {
	id: ThemeId;
	name: string;
	/** Solid accent colour — shown as the swatch dot. */
	accent: string;
	/** Surface/base colour — shown as the swatch chip background. */
	surface: string;
}

export const THEMES: ThemeMeta[] = [
	{ id: "teal", name: "Abyss Teal", accent: "#4fd1c5", surface: "#0b0f17" },
	{ id: "light", name: "Daylight", accent: "#0d9488", surface: "#f6f7f9" },
];

const THEME_KEY = "ds-theme";
const VALID_THEMES = new Set<ThemeId>(THEMES.map((t) => t.id));

function applyTheme(id: ThemeId): void {
	if (typeof document === "undefined") return;
	const el = document.documentElement;
	el.setAttribute("data-theme", id);
	el.setAttribute("data-color-scheme", id === "light" ? "light" : "dark");
}

function initialTheme(): ThemeId {
	if (typeof localStorage === "undefined") return "light";
	try {
		const saved = localStorage.getItem(THEME_KEY) as ThemeId | null;
		if (saved && VALID_THEMES.has(saved)) return saved;
	} catch {
		/* ignore */
	}
	return "light";
}

const [theme, setThemeSignal] = createSignal<ThemeId>(initialTheme());
// Apply once on load as a backstop to the inline script in index.html.
applyTheme(theme());

export function setTheme(id: ThemeId): void {
	setThemeSignal(id);
	applyTheme(id);
	try {
		localStorage.setItem(THEME_KEY, id);
	} catch {
		/* ignore */
	}
}

/* ── Artifact preview ───────────────────────────────────────────── */

export interface Artifact {
	id: string;
	title: string;
	tool: string;
	/** Typed rich content blocks from the tool result. */
	content: ToolResultContent[];
	/** Optional fallback plain-text summary. */
	output?: string;
	timestamp: number;
}

const [activeArtifact, setActiveArtifact] = createSignal<Artifact | null>(null);

export function openArtifact(
	title: string,
	tool: string,
	content: ToolResultContent[] | string,
	output?: string,
	id?: string,
): void {
	const blocks: ToolResultContent[] =
		typeof content === "string" ? (content.trim() ? [{ type: "text", text: content }] : []) : content;
	closeWorkspaceFile();
	setActiveArtifact({
		id: id ?? `artifact_${Date.now()}`,
		title,
		tool,
		content: blocks,
		output,
		timestamp: Date.now(),
	});
	setActiveTraceView("artifacts");
	setRightWidth((width) => Math.max(width, 400));
	setRightCollapsed(false);
}

export function closeArtifact(): void {
	setActiveArtifact(null);
}

/* ── Workspace files ───────────────────────────────────────────── */

const [workspaceFiles, setWorkspaceFiles] = createSignal<WorkspaceFileEntry[]>([]);
const [workspacePath, setWorkspacePath] = createSignal("");
const [workspaceParentPath, setWorkspaceParentPath] = createSignal("");
const [workspaceRoot, setWorkspaceRoot] = createSignal("");
const [workspaceFilesLoading, setWorkspaceFilesLoading] = createSignal(false);
const [workspaceFilesError, setWorkspaceFilesError] = createSignal("");
const [workspaceFilesTruncated, setWorkspaceFilesTruncated] = createSignal(false);
const [activeWorkspaceFile, setActiveWorkspaceFile] = createSignal<WorkspaceFilePreview | null>(null);
const [workspaceFileLoading, setWorkspaceFileLoading] = createSignal(false);
const [workspaceFileError, setWorkspaceFileError] = createSignal("");

export async function loadWorkspaceFiles(path = workspacePath(), silent = false): Promise<void> {
	const sessionId = activeSessionId();
	const projectDirectory = workspaceSelection()?.directory;
	if (!sessionId && !projectDirectory) {
		batch(() => {
			setWorkspaceFiles([]);
			setWorkspacePath("");
			setWorkspaceParentPath("");
			setWorkspaceRoot("");
			setWorkspaceFilesLoading(false);
			setWorkspaceFilesError("");
			setWorkspaceFilesTruncated(false);
		});
		return;
	}
	setWorkspaceFilesLoading(true);
	setWorkspaceFilesError("");
	try {
		const payload = await api.fetchWorkspaceFiles(path, sessionId ?? undefined, projectDirectory);
		batch(() => {
			setWorkspaceFiles(payload.entries);
			setWorkspacePath(payload.path);
			setWorkspaceParentPath(payload.parentPath);
			setWorkspaceRoot(payload.workspace);
			setWorkspaceFilesTruncated(payload.truncated);
		});
		if (!silent) setComposerStatus(`Workspace: /${payload.path}`);
	} catch (error) {
		setWorkspaceFiles([]);
		setWorkspaceFilesError(error instanceof Error ? error.message : String(error));
	} finally {
		setWorkspaceFilesLoading(false);
	}
}

export async function openWorkspaceFile(path: string): Promise<void> {
	const sessionId = activeSessionId();
	const projectDirectory = workspaceSelection()?.directory;
	if (!sessionId && !projectDirectory) return;
	setWorkspaceFileLoading(true);
	setWorkspaceFileError("");
	setActiveWorkspaceFile(null);
	closeArtifact();
	setActiveTraceView("artifacts");
	setRightWidth((width) => Math.max(width, 400));
	setRightCollapsed(false);
	try {
		setActiveWorkspaceFile(await api.fetchWorkspaceFile(path, sessionId ?? undefined, projectDirectory));
	} catch (error) {
		setWorkspaceFileError(error instanceof Error ? error.message : String(error));
	} finally {
		setWorkspaceFileLoading(false);
	}
}

export function closeWorkspaceFile(): void {
	setActiveWorkspaceFile(null);
	setWorkspaceFileLoading(false);
	setWorkspaceFileError("");
}

/* ── Active view ───────────────────────────────────────────────── */

const [activeView, setActiveView] = createSignal<"workspace" | "skills" | "resources" | "literature">("workspace");

/* ── Re-exports ─────────────────────────────────────────────────── */

export {
	agents,
	models,
	selectedAgent,
	setSelectedAgent,
	selectedModel,
	setSelectedModel,
	selectedThinkingLevel,
	setSelectedThinkingLevel,
	session,
	messages,
	timeline,
	streaming,
	connState,
	composerStatus,
	leftWidth,
	setLeftWidth,
	rightWidth,
	setRightWidth,
	leftCollapsed,
	setLeftCollapsed,
	rightCollapsed,
	setRightCollapsed,
	activeLeftTab,
	setActiveLeftTab,
	activeTraceView,
	setActiveTraceView,
	sessionList,
	activeSessionId,
	settingsOpen,
	setSettingsOpen,
	theme,
	activeArtifact,
	workspaceFiles,
	workspacePath,
	workspaceParentPath,
	workspaceRoot,
	workspaceFilesLoading,
	workspaceFilesError,
	workspaceFilesTruncated,
	activeWorkspaceFile,
	workspaceFileLoading,
	workspaceFileError,
	activeView,
	setActiveView,
	workspaceSelection,
	workspaceProjects,
	capabilities,
	featureEnabled,
	settingsPanelVisible,
	settingsPanelSupport,
};
