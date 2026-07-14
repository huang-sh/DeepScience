import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { Agent } from "@earendil-works/pi-agent-core";
import {
	AgentSession,
	AuthStorage,
	DefaultResourceLoader,
	type ExtensionFactory,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { type ProvenanceMeta, withProvenance } from "@shying/ds-science";

interface PromptRef {
	base: string;
	current: string;
}

export interface DeepScienceCodingRuntime {
	readonly session: AgentSession;
	setSystemPrompt(prompt: string): void;
	setModelProvider(provider: string): void;
	dispose(): void;
}

export interface CreateDeepScienceCodingRuntimeOptions {
	agent: Agent;
	cwd: string;
	sessionID: string;
	systemPrompt: string;
	extensionFactories: ExtensionFactory[];
	extensionPaths?: string[];
	appendSystemPrompt?: string[];
	createToolProvenance(toolName: string): ProvenanceMeta;
}

/**
 * Hosts DeepScience capabilities inside pi-coding-agent without introducing a
 * second durable session store. DeepScience remains responsible for its
 * transcript/workspace persistence; Pi owns the live agent runtime, extension
 * hooks and tool registry.
 */
export async function createDeepScienceCodingRuntime(
	options: CreateDeepScienceCodingRuntimeOptions,
): Promise<DeepScienceCodingRuntime> {
	const promptRef: PromptRef = { base: options.systemPrompt, current: options.systemPrompt };
	const hostExtension = createHostExtension(promptRef, options.createToolProvenance);
	const configuredExtensionPaths = (process.env.DEEPSCIENCE_EXTENSION_PATHS ?? "")
		.split(delimiter)
		.map((path) => path.trim())
		.filter(Boolean);
	const managedExtensionDirectory = join(
		process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience"),
		"extensions",
	);
	const additionalExtensionPaths = [
		...(existsSync(managedExtensionDirectory) ? [managedExtensionDirectory] : []),
		...configuredExtensionPaths,
		...(options.extensionPaths ?? []),
	];
	// pi-mcp-adapter uses Pi's agent directory for its global config, metadata
	// cache, and OAuth state. Keep that state in DeepScience's own data root.
	process.env.PI_CODING_AGENT_DIR ??= process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience");
	// The proxy tool keeps the model context small and discovers remote tools
	// only when needed. Users can explicitly override this environment setting.
	process.env.MCP_DIRECT_TOOLS ??= "__none__";
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: false },
		enableSkillCommands: false,
	});
	const resourceLoader = new DefaultResourceLoader({
		cwd: options.cwd,
		agentDir: options.cwd,
		settingsManager,
		additionalExtensionPaths,
		extensionFactories: [hostExtension, ...options.extensionFactories],
		noExtensions: false,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		systemPrompt: options.systemPrompt,
		appendSystemPrompt: options.appendSystemPrompt,
	});
	await resourceLoader.reload();

	// AgentSession validates provider readiness before starting a turn. The
	// actual request still flows through DeepScience's configured pi-ai streamFn;
	// this in-memory marker carries no credential and is never persisted.
	const provider = options.agent.state.model?.provider;
	const authStorage = AuthStorage.inMemory(
		provider ? { [provider]: { type: "api_key", key: "deepscience-host-managed" } } : {},
	);
	const modelRegistry = ModelRegistry.inMemory(authStorage);
	const sessionManager = SessionManager.inMemory(options.cwd, { id: options.sessionID });
	const session = new AgentSession({
		agent: options.agent,
		sessionManager,
		settingsManager,
		cwd: options.cwd,
		resourceLoader,
		modelRegistry,
		baseToolsOverride: {},
		sessionStartEvent: { type: "session_start", reason: "startup" },
	});
	// AgentSession deliberately leaves extension lifecycle binding to its host
	// mode. DeepScience is a headless Web/CLI host, so bind the print-mode
	// context explicitly; this emits session_start for all Pi extensions.
	await session.bindExtensions({ mode: "print" });

	return {
		session,
		setSystemPrompt(prompt) {
			promptRef.current = prompt;
			options.agent.state.systemPrompt = replaceBasePrompt(options.agent.state.systemPrompt, promptRef.base, prompt);
		},
		setModelProvider(nextProvider) {
			authStorage.setRuntimeApiKey(nextProvider, "deepscience-host-managed");
		},
		dispose() {
			// Pi currently emits session_shutdown as part of reload. Use that
			// graceful boundary before invalidating the runtime so extensions can
			// close child processes, sockets, and OAuth callback state.
			void session
				.reload()
				.catch((error: unknown) => console.error("Extension shutdown failed", error))
				.finally(() => session.dispose());
		},
	};
}

function createHostExtension(
	promptRef: PromptRef,
	createToolProvenance: (toolName: string) => ProvenanceMeta,
): ExtensionFactory {
	return (pi) => {
		pi.on("before_agent_start", (event) => {
			if (promptRef.current === promptRef.base) return undefined;
			return { systemPrompt: replaceBasePrompt(event.systemPrompt, promptRef.base, promptRef.current) };
		});
		pi.on("tool_result", (event) => ({
			details: withProvenance(
				(event.details && typeof event.details === "object" ? event.details : {}) as Record<string, unknown>,
				createToolProvenance(event.toolName),
			),
			isError: event.isError || hasErrorDetail(event.details),
		}));
	};
}

function replaceBasePrompt(systemPrompt: string, basePrompt: string, nextBasePrompt: string): string {
	return systemPrompt.includes(basePrompt)
		? systemPrompt.replace(basePrompt, nextBasePrompt)
		: `${nextBasePrompt}\n\n---\n\n${systemPrompt}`;
}

function hasErrorDetail(details: unknown): boolean {
	return details !== null && typeof details === "object" && "error" in details && details.error === true;
}
