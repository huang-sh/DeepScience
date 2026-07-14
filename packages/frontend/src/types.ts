/* ================================================================
   DeepScience frontend — shared types

   SSE event contract from server session.ts,
   /agent + /api/models list shapes, session list,
   and timeline/trace entries derived from tool events.
   ================================================================ */

export interface AgentInfo {
	name: string;
	description: string;
	color: string;
	mode?: string;
}

export interface ModelRef {
	provider: string;
	id: string;
	name: string;
	reasoning?: boolean;
	vision?: boolean;
	thinkingLevels?: ThinkingLevel[];
}

export interface PromptImage {
	data: string;
	mimeType: string;
	name?: string;
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ProviderCredentialStatus {
	id: string;
	name: string;
	configured: boolean;
	stored: boolean;
	source?: string;
	envVariable?: string;
	modelCount: number;
	manageable: boolean;
	oauthSupported: boolean;
	oauthName?: string;
	oauthStored: boolean;
}

export interface ProviderCredentialResponse {
	providers: ProviderCredentialStatus[];
}

export type ProviderOAuthPhase = "pending" | "waiting" | "complete" | "error" | "cancelled";

export interface ProviderOAuthJob {
	id: string;
	provider: string;
	providerName: string;
	authName: string;
	phase: ProviderOAuthPhase;
	event?:
		| { type: "auth_url"; url: string; instructions?: string }
		| {
				type: "device_code";
				userCode: string;
				verificationUri: string;
				intervalSeconds?: number;
				expiresInSeconds?: number;
		  }
		| { type: "progress"; message: string };
	prompt?: {
		id: string;
		type: "text" | "secret" | "select" | "manual_code";
		message: string;
		placeholder?: string;
		options?: Array<{ id: string; label: string; description?: string }>;
	};
	error?: string;
	createdAt: number;
	updatedAt: number;
}

export interface DeepSciencePreferences {
	defaultAgent?: string;
	defaultModel?: ModelRef;
	visionModel?: ModelRef;
	updatedAt?: number;
}

export interface SessionInfo {
	id: string;
	agentName: string;
	model: ModelRef;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	preview: string;
	projectID?: string;
	directory?: string;
	projectDirectory?: string;
	worktree?: string;
	workspaceKind?: "project" | "git-worktree";
	thinkingLevel?: ThinkingLevel;
	parentID?: string;
	forkedFrom?: { sessionID: string; messageID?: string };
}

export interface WorkspaceFileEntry {
	name: string;
	path: string;
	type: "directory" | "file";
	size: number;
	modifiedAt: number;
}

export interface WorkspaceFileList {
	workspace: string;
	path: string;
	parentPath: string;
	entries: WorkspaceFileEntry[];
	truncated: boolean;
}

export interface WorkspaceFilePreview {
	name: string;
	path: string;
	previewType: "image" | "text" | "unsupported";
	mimeType: string;
	size: number;
	content: string;
}

export interface WorkspaceInstance {
	projectID: string;
	directory: string;
	worktree: string;
	workspaceKind: "project" | "git-worktree";
	vcs?: "git";
}

export interface WorkspaceProject {
	id: string;
	title: string;
	worktree: string;
	vcs?: "git";
	directories: string[];
	createdAt: number;
	updatedAt: number;
}

export interface WorkspaceSelection extends WorkspaceProject {
	projectID: string;
	directory: string;
	workspaceKind: "project" | "git-worktree";
}

export interface WorkspaceDirectoryListing {
	directory: string;
	parent: string;
	directories: Array<{ name: string; path: string }>;
}

export interface ResourceFile {
	path: string;
	workspacePath: string;
	exists: boolean;
	size: number;
}

export interface ResourceEntry {
	id: string;
	skillName: string;
	name: string;
	dbName: string;
	category: string;
	categoryPath: string[];
	content: string[];
	files: ResourceFile[];
	url: string;
	citation: string;
	accessMode: "local" | "remote" | "hybrid";
	loaded: boolean;
}

export interface ResourceCatalogResponse {
	resources: ResourceEntry[];
	loaded: string[];
	categories: Array<{ name: string; count: number }>;
	stats: {
		entries: number;
		uniqueDatabases: number;
		referencedFiles: number;
		localFiles: number;
		missingFiles: number;
		totalBytes: number;
	};
}

export interface SkillSummary {
	name: string;
	description: string;
	category: string;
	categoryPath: string[];
	source:
		| "deepscience"
		| "tooluniverse"
		| "bioskills"
		| "project"
		| "claude"
		| "user"
		| "learned"
		| "installed"
		| "cache";
	sourceLabel: string;
	filePath: string;
	disableModelInvocation: boolean;
	aliases: string[];
	loaded: boolean;
}

export interface SkillDetail extends SkillSummary {
	content: string;
}

export interface SkillListResponse {
	skills: SkillSummary[];
	categories: string[];
	categoryTree: Array<{
		name: string;
		path: string;
		count: number;
		children: Array<{ name: string; path: string; count: number }>;
	}>;
	total: number;
	loaded: string[];
	sources: Array<{ id: SkillSummary["source"]; label: string; count: number }>;
	duplicates: number;
}

export interface SkillDiagnostic {
	type: "warning";
	code: string;
	message: string;
	path: string;
	source: SkillSummary["source"];
}

/* — Rich tool result content blocks (mirrors server result.ts) — */

export interface TextContentBlock {
	type: "text";
	text: string;
}

export interface ImageContentBlock {
	type: "image";
	/** base64-encoded image bytes (no data: prefix) */
	data: string;
	mimeType: string;
}

export type ToolResultContent = TextContentBlock | ImageContentBlock;
export type ToolStatus = "running" | "done" | "error" | "stopped";

/* — SSE events from POST /session/:id/message — */

export type SSEEvent =
	| { type: "turn_start"; turnIndex: number }
	| {
			type: "text_delta";
			turnIndex: number;
			contentIndex: number;
			delta: string;
			phase: "pending" | "process" | "final";
	  }
	| {
			type: "thinking_delta";
			turnIndex: number;
			contentIndex: number;
			delta: string;
			redacted: boolean;
	  }
	| { type: "assistant_end"; turnIndex: number; stopReason: string; errorMessage?: string }
	| { type: "tool_start"; turnIndex: number; tool: string; args: Record<string, unknown>; callId: string }
	| {
			type: "tool_update";
			turnIndex: number;
			tool: string;
			callId: string;
			content: ToolResultContent[];
			output: string;
			details?: Record<string, unknown>;
	  }
	| {
			type: "tool_end";
			turnIndex: number;
			tool: string;
			callId: string;
			content: ToolResultContent[];
			output: string;
			isError?: boolean;
			details?: Record<string, unknown>;
	  }
	| { type: "turn_end"; turnIndex: number }
	| { type: "agent_end"; turnIndex: number; stopReason: string; errorMessage?: string }
	| { type: "error"; message: string }
	| { type: "done" };

/* — Client-side message model — */

export interface ToolCallPart {
	kind: "tool";
	id: string;
	tool: string;
	args?: Record<string, unknown>;
	/** Bounded plain-text summary (legacy-compatible). */
	output?: string;
	/** Typed rich content blocks when the server emits them. */
	content?: ToolResultContent[];
	details?: Record<string, unknown>;
	callId?: string;
	turnIndex?: number;
	status: ToolStatus;
}

export interface TextPart {
	kind: "text";
	id?: string;
	text: string;
	turnIndex?: number;
	phase?: "pending" | "process" | "final";
	streaming?: boolean;
}

export interface ThinkingPart {
	kind: "thinking";
	id: string;
	text: string;
	turnIndex: number;
	redacted?: boolean;
	streaming?: boolean;
}

export interface ImagePart {
	kind: "image";
	id: string;
	data: string;
	mimeType: string;
	name?: string;
}

export type MessagePart = ToolCallPart | TextPart | ThinkingPart | ImagePart;

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "tool" | "error";
	parts: MessagePart[];
	streaming?: boolean;
	timestamp: number;
}

/* — Timeline / trace entry (right panel) — */

export interface TraceEntry {
	id: string;
	tool: string;
	status: ToolStatus;
	timestamp: number;
	detail?: string;
}

/* — Connection — */

export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface ConnectorSummary {
	name: string;
	transport: "stdio" | "http";
	command?: string;
	args?: string[];
	url?: string;
	lifecycle: "lazy" | "eager" | "keep-alive";
	auth: "none" | "bearer" | "oauth";
	hasEnvironment: boolean;
	hasHeaders: boolean;
}

export interface ConnectorCatalog {
	configPath: string;
	exists: boolean;
	connectors: ConnectorSummary[];
	diagnostics: Array<{ level: "info" | "warning"; message: string }>;
}

export interface ConnectorDefinition {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
	url?: string;
	headers?: Record<string, string>;
	auth?: "bearer" | "oauth" | false;
	bearerTokenEnv?: string;
	lifecycle?: "lazy" | "eager" | "keep-alive";
	idleTimeout?: number;
	requestTimeoutMs?: number;
	exposeResources?: boolean;
	excludeTools?: string[];
	debug?: boolean;
}

export interface ConnectorTestResult {
	ok: true;
	server: { name?: string; version?: string };
	toolCount: number;
	resourceCount: number;
	durationMs: number;
}

/* — Server capabilities (from GET /api/capabilities) — */

export interface CapabilityFeatures {
	sessions: boolean;
	agents: boolean;
	models: boolean;
	scienceArtifacts: boolean;
	researchGraph: boolean;
	fileBrowsing: boolean;
	projectWorkspaces: boolean;
	gitWorktrees: boolean;
	account: boolean;
	managedBilling: boolean;
	wallet: boolean;
	providerOAuth: boolean;
	mcpManagement: boolean;
	pty: boolean;
	lsp: boolean;
	formatter: boolean;
}

export type SettingsPanelSupport = boolean | "appearance-only";

export interface CapabilitySettings {
	capabilities: boolean;
	skills: SettingsPanelSupport;
	specialists: SettingsPanelSupport;
	memory: SettingsPanelSupport;
	compute: SettingsPanelSupport;
	"local-models": SettingsPanelSupport;
	permissions: SettingsPanelSupport;
	sandbox: SettingsPanelSupport;
	credentials: SettingsPanelSupport;
	storage: SettingsPanelSupport;
	general: SettingsPanelSupport;
}

export interface Capabilities {
	brand: string;
	version: string;
	features: CapabilityFeatures;
	settings: CapabilitySettings;
}

/* — History (from GET /session/:id/message) — */

export interface HistoryPart {
	id?: string;
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
	phase?: "process" | "final";
	redacted?: boolean;
	tool?: string;
	callId?: string;
	output?: string;
	content?: ToolResultContent[];
	details?: Record<string, unknown>;
	synthetic?: boolean;
	state?: { status?: string };
}

export interface HistoryMessage {
	info?: {
		id?: string;
		role?: string;
		stopReason?: string;
		errorMessage?: string;
		sessionID?: string;
		time?: { created?: number };
	};
	parts?: HistoryPart[];
}
