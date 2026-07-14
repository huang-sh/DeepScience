/* ================================================================
   DeepScience API client

   Talks to the DeepScience server (sdk-routes.ts contract).
   POST /session/:id/message streams SSE via fetch + ReadableStream.
   ================================================================ */

import type {
	AgentInfo,
	Capabilities,
	ConnectorCatalog,
	ConnectorDefinition,
	ConnectorTestResult,
	DeepSciencePreferences,
	HistoryMessage,
	ModelRef,
	PromptImage,
	ProviderCredentialResponse,
	ProviderOAuthJob,
	ResourceCatalogResponse,
	SessionInfo,
	SkillDetail,
	SkillDiagnostic,
	SkillListResponse,
	SSEEvent,
	ThinkingLevel,
	WorkspaceDirectoryListing,
	WorkspaceFileList,
	WorkspaceFilePreview,
	WorkspaceInstance,
	WorkspaceProject,
	WorkspaceSelection,
} from "./types";

const BASE = "";

interface ApiErrorBody {
	error?: string;
	code?: string;
	details?: Record<string, unknown>;
}

export class ApiClientError extends Error {
	readonly status: number;
	readonly code?: string;
	readonly details?: Record<string, unknown>;

	constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
		super(message);
		this.name = "ApiClientError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseError(res: Response): Promise<ApiClientError> {
	const text = await res.text().catch(() => "");
	let body: ApiErrorBody | undefined;
	try {
		const parsed: unknown = JSON.parse(text);
		if (isRecord(parsed)) {
			body = {
				error: typeof parsed.error === "string" ? parsed.error : undefined,
				code: typeof parsed.code === "string" ? parsed.code : undefined,
				details: isRecord(parsed.details) ? parsed.details : undefined,
			};
		}
	} catch {
		/* The response may be plain text. */
	}
	const message = body?.error ?? (text.trim() || `${res.status} ${res.statusText}`);
	return new ApiClientError(message, res.status, body?.code, body?.details);
}

async function getJSON<T>(path: string): Promise<T> {
	const res = await fetch(`${BASE}${path}`);
	if (!res.ok) throw await responseError(res);
	return res.json() as Promise<T>;
}

async function requestJSON<T>(path: string, body: unknown, method: "POST" | "PUT" | "PATCH" | "DELETE"): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) throw await responseError(res);
	return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
	return requestJSON<T>(path, body, "POST");
}

/* — Public API — */

export function fetchCapabilities(): Promise<Capabilities> {
	return getJSON<Capabilities>("/api/capabilities");
}

export function fetchAgents(): Promise<AgentInfo[]> {
	return getJSON<AgentInfo[]>("/agent");
}

export function fetchModels(): Promise<Record<string, ModelRef[]>> {
	return getJSON("/api/models");
}

export function fetchProviders(): Promise<ProviderCredentialResponse> {
	return getJSON("/api/providers");
}

export function refreshProviderModels(provider: string): Promise<{
	ok: boolean;
	models: ModelRef[];
	warning?: string;
}> {
	return postJSON(`/api/providers/${encodeURIComponent(provider)}/models/refresh`);
}

export function fetchConnectors(): Promise<ConnectorCatalog> {
	return getJSON<ConnectorCatalog>("/api/connectors");
}

export function saveConnector(name: string, definition: ConnectorDefinition): Promise<ConnectorCatalog> {
	return requestJSON<ConnectorCatalog>(`/api/connectors/${encodeURIComponent(name)}`, definition, "PUT");
}

export function deleteConnector(name: string): Promise<ConnectorCatalog> {
	return requestJSON<ConnectorCatalog>(`/api/connectors/${encodeURIComponent(name)}`, undefined, "DELETE");
}

export function testConnector(
	directory: string,
	name: string,
	definition: ConnectorDefinition,
): Promise<ConnectorTestResult> {
	return postJSON<ConnectorTestResult>(`/api/connectors/test?directory=${encodeURIComponent(directory)}`, {
		name,
		definition,
	});
}

export function saveProviderApiKey(provider: string, apiKey: string): Promise<ProviderCredentialResponse> {
	return requestJSON(`/api/providers/${encodeURIComponent(provider)}/api-key`, { apiKey }, "PUT");
}

export function deleteProviderApiKey(provider: string): Promise<ProviderCredentialResponse> {
	return requestJSON(`/api/providers/${encodeURIComponent(provider)}/api-key`, undefined, "DELETE");
}

export function startProviderOAuth(provider: string): Promise<ProviderOAuthJob> {
	return postJSON(`/api/providers/${encodeURIComponent(provider)}/oauth`);
}

export function fetchProviderOAuth(jobId: string): Promise<ProviderOAuthJob> {
	return getJSON(`/api/provider-oauth/${encodeURIComponent(jobId)}`);
}

export function respondProviderOAuth(jobId: string, promptId: string, value: string): Promise<ProviderOAuthJob> {
	return postJSON(`/api/provider-oauth/${encodeURIComponent(jobId)}/respond`, { promptId, value });
}

export function cancelProviderOAuth(jobId: string): Promise<ProviderOAuthJob> {
	return requestJSON(`/api/provider-oauth/${encodeURIComponent(jobId)}`, undefined, "DELETE");
}

export function logoutProviderOAuth(provider: string): Promise<ProviderCredentialResponse> {
	return requestJSON(`/api/providers/${encodeURIComponent(provider)}/oauth`, undefined, "DELETE");
}

export function fetchSessions(directory?: string): Promise<SessionInfo[]> {
	const query = directory ? `?directory=${encodeURIComponent(directory)}` : "";
	return getJSON<SessionInfo[]>(`/session${query}`);
}

export function deleteSession(sessionId: string): Promise<{ ok: boolean }> {
	return requestJSON<{ ok: boolean }>(`/session/${encodeURIComponent(sessionId)}`, undefined, "DELETE");
}

export function forkSession(sessionId: string, messageId?: string): Promise<SessionInfo> {
	return postJSON<SessionInfo>(
		`/session/${encodeURIComponent(sessionId)}/fork`,
		messageId ? { messageID: messageId } : {},
	);
}

export function fetchPreferences(): Promise<DeepSciencePreferences> {
	return getJSON<DeepSciencePreferences>("/api/preferences");
}

export function updatePreferences(
	patch: Pick<DeepSciencePreferences, "defaultAgent" | "defaultModel"> & { visionModel?: ModelRef | null },
): Promise<DeepSciencePreferences> {
	return requestJSON<DeepSciencePreferences>("/api/preferences", patch, "PUT");
}

export function fetchMessages(sessionId: string): Promise<HistoryMessage[]> {
	return getJSON<HistoryMessage[]>(`/session/${sessionId}/message`);
}

export async function createSession(
	agent: string,
	model?: ModelRef,
	directory?: string,
	thinkingLevel: ThinkingLevel = "medium",
): Promise<SessionInfo> {
	return postJSON<SessionInfo>("/session", { agent, model, directory, thinkingLevel });
}

export function updateSessionModel(sessionId: string, model: ModelRef): Promise<SessionInfo> {
	return requestJSON<SessionInfo>(`/session/${sessionId}`, { model }, "PATCH");
}

export function updateSessionThinkingLevel(sessionId: string, thinkingLevel: ThinkingLevel): Promise<SessionInfo> {
	return requestJSON<SessionInfo>(`/session/${sessionId}`, { thinkingLevel }, "PATCH");
}

export function abortSession(sessionId: string): Promise<{ ok: boolean }> {
	return postJSON<{ ok: boolean }>(`/session/${sessionId}/abort`, {});
}

export function fetchWorkspaceFiles(path = "", sessionId?: string, directory?: string): Promise<WorkspaceFileList> {
	const query = new URLSearchParams();
	if (path) query.set("path", path);
	if (sessionId) query.set("session_id", sessionId);
	if (!sessionId && directory) query.set("directory", directory);
	return getJSON<WorkspaceFileList>(`/api/workspace/files?${query.toString()}`);
}

export function fetchWorkspaceFile(
	path: string,
	sessionId?: string,
	directory?: string,
): Promise<WorkspaceFilePreview> {
	const query = new URLSearchParams({ path });
	if (sessionId) query.set("session_id", sessionId);
	if (!sessionId && directory) query.set("directory", directory);
	return getJSON<WorkspaceFilePreview>(`/api/workspace/file?${query.toString()}`);
}

export function fetchResources(sessionId?: string): Promise<ResourceCatalogResponse> {
	const query = new URLSearchParams();
	if (sessionId) query.set("session_id", sessionId);
	return getJSON<ResourceCatalogResponse>(`/api/resources?${query.toString()}`);
}

export function resourceFileRawUrl(path: string): string {
	return `/api/resources/file?${new URLSearchParams({ path }).toString()}`;
}

export function workspaceFileRawUrl(path: string, sessionId?: string, directory?: string): string {
	const query = new URLSearchParams({ path });
	if (sessionId) query.set("session_id", sessionId);
	if (!sessionId && directory) query.set("directory", directory);
	return `/api/workspace/file/raw?${query.toString()}`;
}

export function fetchProjects(): Promise<WorkspaceProject[]> {
	return getJSON<WorkspaceProject[]>("/project");
}

export function browseWorkspaceDirectories(path?: string): Promise<WorkspaceDirectoryListing> {
	const query = new URLSearchParams();
	if (path) query.set("path", path);
	return getJSON<WorkspaceDirectoryListing>(`/project/directories?${query.toString()}`);
}

export function fetchCurrentProject(): Promise<WorkspaceSelection> {
	return getJSON<WorkspaceSelection>("/project/current");
}

export function openWorkspace(directory: string, create = false): Promise<WorkspaceSelection> {
	return postJSON<WorkspaceSelection>("/project", { directory, create });
}

export function fetchGitWorktrees(directory?: string): Promise<{ worktrees: WorkspaceInstance[] }> {
	const query = new URLSearchParams();
	if (directory) query.set("directory", directory);
	return getJSON<{ worktrees: WorkspaceInstance[] }>(`/api/worktrees?${query.toString()}`);
}

export function createGitWorktree(input: {
	directory?: string;
	name: string;
	branch?: string;
	baseRef?: string;
}): Promise<WorkspaceInstance> {
	return postJSON<WorkspaceInstance>("/api/worktrees", input);
}

export function removeGitWorktree(directory: string, force = false): Promise<{ ok: boolean }> {
	return requestJSON<{ ok: boolean }>("/api/worktrees", { directory, force }, "DELETE");
}

export function fetchSkills(options?: {
	query?: string;
	category?: string;
	source?: SkillListResponse["sources"][number]["id"];
	sessionId?: string;
	limit?: number;
	directoryOnly?: boolean;
}): Promise<SkillListResponse> {
	const query = new URLSearchParams();
	if (options?.query) query.set("q", options.query);
	if (options?.category) query.set("category", options.category);
	if (options?.source) query.set("source", options.source);
	if (options?.sessionId) query.set("session_id", options.sessionId);
	if (options?.directoryOnly) query.set("directory_only", "true");
	query.set("limit", String(options?.limit ?? 5_000));
	return getJSON<SkillListResponse>(`/api/skills?${query.toString()}`);
}

export async function fetchSkill(name: string, sessionId?: string): Promise<SkillDetail> {
	const query = new URLSearchParams();
	if (sessionId) query.set("session_id", sessionId);
	const payload = await getJSON<{ skill: SkillDetail }>(`/api/skills/${encodeURIComponent(name)}?${query.toString()}`);
	return payload.skill;
}

export async function fetchSkillDiagnostics(): Promise<SkillDiagnostic[]> {
	const payload = await getJSON<{ diagnostics: SkillDiagnostic[] }>("/api/skills/diagnostics");
	return payload.diagnostics;
}

export function refreshSkillCatalog(): Promise<{
	ok: boolean;
	total: number;
	duplicates: number;
	diagnostics: number;
}> {
	return postJSON("/api/skills/refresh");
}

/**
 * Send a message and stream the response over SSE.
 * POST + ReadableStream (native EventSource can't POST).
 */
export function streamMessage(
	sessionId: string,
	message: string,
	images: PromptImage[],
	onEvent: (event: SSEEvent) => void,
	onError: (err: Error) => void,
	onDone: () => void,
): AbortController {
	const controller = new AbortController();

	(async () => {
		try {
			const res = await fetch(`${BASE}/session/${sessionId}/message`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message, images }),
				signal: controller.signal,
			});

			if (!res.ok) throw await responseError(res);

			const reader = res.body?.getReader();
			if (!reader) throw new Error("No response body");

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const frames = buffer.split("\n\n");
				buffer = frames.pop() ?? "";

				for (const frame of frames) {
					const event = parseSSEFrame(frame);
					if (event) onEvent(event);
				}
			}

			if (buffer.trim()) {
				const event = parseSSEFrame(buffer);
				if (event) onEvent(event);
			}

			onDone();
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				return;
			}
			onError(err instanceof Error ? err : new Error(String(err)));
		}
	})();

	return controller;
}

function parseSSEFrame(frame: string): SSEEvent | null {
	for (const line of frame.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) continue;
		if (trimmed === "data:") continue;

		const json = trimmed.slice(5).trim();
		try {
			return JSON.parse(json) as SSEEvent;
		} catch {}
	}
	return null;
}

/* — Health check — */

export async function checkConnection(): Promise<boolean> {
	try {
		await getJSON("/agent");
		return true;
	} catch {
		return false;
	}
}
