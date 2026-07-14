import { evaluate, getAgentConfig, listAgents, type Ruleset } from "@shying/ds-science";
import type { Hono } from "hono";
import { stream } from "hono/streaming";
import { serveArtifactContentFromRoot } from "./artifacts.ts";
import {
	type ConnectorDefinition,
	deleteConnector,
	readConnectorCatalog,
	saveConnector,
	testConnector,
} from "./connectors.ts";
import { readPreferences, savePreferences } from "./preferences.ts";
import { normalizePromptImages, PromptImageValidationError } from "./prompt-images.ts";
import { enrichProviderOAuthStatus, providerOAuth } from "./provider-oauth.ts";
import { loadResourceCatalog, serveResourceFile } from "./resources.ts";
import { normalizeToolResultContent, summarizeToolResultContent } from "./result.ts";
import {
	abortSessionAndWait,
	apiError,
	BusyError,
	compactSession,
	createChildSession,
	createSession,
	deleteProviderApiKey,
	deleteSession,
	forkSession,
	getSession,
	getSessionDiffs,
	getSessionResourceState,
	getSessionSkillState,
	getSessionSummary,
	getSessionTodos,
	isValidMessageId,
	isValidPartId,
	isValidSessionId,
	listAvailableModels,
	listChildSessions,
	listProviderCredentialStatus,
	listSessions,
	ModelConfigurationError,
	NotFoundError,
	refreshProviderModels,
	releaseSessionPrompt,
	reserveSessionPrompt,
	revertSession,
	runSessionPrompt,
	saveProviderApiKey,
	setSessionDiffs,
	setSessionTodos,
	sseFormat,
	summarizeSession,
	unrevertSession,
	updateSessionModel,
	updateSessionThinkingLevel,
	ValidationError,
} from "./session.ts";
import type { SessionSidecar } from "./session-store.ts";
import { isSkillSourceId, type SkillCatalogEntry, type SkillSourceId, skillCatalog } from "./skill-catalog.ts";
import {
	deleteInstalledSkillSource,
	deleteManagedSkill,
	installSkillSource,
	type ManagedSkillInput,
	readSkillUsage,
	saveManagedSkill,
} from "./skill-lifecycle.ts";
import { listWorkspaceFiles, previewWorkspaceFile, WorkspacePathError } from "./workspace-files.ts";
import {
	browseWorkspaceDirectories,
	createGitWorktree,
	listGitWorktrees,
	listWorkspaceProjects,
	openWorkspaceProject,
	registerWorkspaceInstance,
	removeGitWorktree,
	resolveWorkspaceInstance,
} from "./workspace-instance.ts";

async function resolveRequestWorkspace(sessionID?: string, directory?: string): Promise<string | undefined> {
	if (!sessionID)
		return (await resolveWorkspaceInstance(directory ?? process.env.DEEPSCIENCE_INITIAL_WORKSPACE)).directory;
	const managed = await getSession(sessionID);
	return managed?.info.directory;
}

async function listProviderStatuses() {
	return enrichProviderOAuthStatus(await listProviderCredentialStatus());
}

// SDK-compatible routes (most have no /api prefix).
// These are the endpoints the DeepScience frontend calls through its API client.
export function registerSDKRoutes(app: Hono) {
	app.onError((error, c) => handleSessionError(c, error));

	app.get("/api/artifacts/content", async (c) => {
		const root = await resolveRequestWorkspace(c.req.query("session_id") ?? c.req.query("session_key"));
		if (!root) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return serveArtifactContentFromRoot(c, root);
	});
	app.get("/api/resources", async (c) => {
		const sessionID = c.req.query("session_id");
		const state = sessionID ? await getSessionResourceState(sessionID) : undefined;
		if (sessionID && !state) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		const loaded = new Set(state?.loaded ?? []);
		const payload = await loadResourceCatalog();
		return c.json({
			...payload,
			loaded: [...loaded],
			resources: payload.resources.map((resource) => ({
				...resource,
				loaded: loaded.has(resource.skillName),
			})),
		});
	});
	app.get("/api/resources/file", serveResourceFile);

	// ── Capabilities (DeepScience) ───────────────────────────────────────────
	app.get("/api/capabilities", (c) =>
		c.json({
			brand: "DeepScience",
			version: "0.0.2",
			runtime: {
				agent: "pi-coding-agent",
				model: "pi-ai",
				extensions: true,
				sessionAuthority: "deepscience",
			},
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
				providerOAuth: true,
				mcpManagement: true,
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
		}),
	);

	app.get("/api/connectors", async (c) => {
		try {
			return c.json(await readConnectorCatalog());
		} catch (error) {
			return handleSessionError(c, error);
		}
	});

	app.put("/api/connectors/:name", async (c) => {
		try {
			const body = await c.req.json<ConnectorDefinition>().catch(() => undefined);
			if (!body) return c.json(apiError("Connector definition is required", "VALIDATION_ERROR"), 422);
			await saveConnector(c.req.param("name"), body);
			return c.json(await readConnectorCatalog());
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to save Connector", "VALIDATION_ERROR"),
				422,
			);
		}
	});

	app.post("/api/connectors/test", async (c) => {
		try {
			const project = await resolveWorkspaceInstance(
				c.req.query("directory") ?? process.env.DEEPSCIENCE_INITIAL_WORKSPACE,
			);
			const body = await c.req.json<{ name?: string; definition?: ConnectorDefinition }>().catch(() => undefined);
			if (!body?.name || !body.definition) {
				return c.json(apiError("Connector name and definition are required", "VALIDATION_ERROR"), 422);
			}
			return c.json(await testConnector(project.directory, body.name, body.definition));
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Connector test failed", "CONNECTOR_TEST_FAILED"),
				422,
			);
		}
	});

	app.delete("/api/connectors/:name", async (c) => {
		try {
			const deleted = await deleteConnector(c.req.param("name"));
			if (!deleted) return c.json(apiError("Connector not found", "NOT_FOUND"), 404);
			return c.json(await readConnectorCatalog());
		} catch (error) {
			return handleSessionError(c, error);
		}
	});

	app.get("/api/preferences", async (c) => c.json(await readPreferences()));

	app.put("/api/preferences", async (c) => {
		const body = await c.req
			.json<{
				defaultAgent?: string;
				defaultModel?: { provider?: string; id?: string };
				visionModel?: { provider?: string; id?: string } | null;
			}>()
			.catch(() => undefined);
		if (
			!body ||
			(body.defaultAgent === undefined && body.defaultModel === undefined && body.visionModel === undefined)
		) {
			return c.json(apiError("An agent or model preference is required", "VALIDATION_ERROR"), 422);
		}

		let defaultAgent: string | undefined;
		if (body.defaultAgent) {
			const agents = await listAgents();
			if (!agents.some((agent) => agent.name === body.defaultAgent)) {
				return c.json(apiError("Unknown agent", "VALIDATION_ERROR"), 422);
			}
			defaultAgent = body.defaultAgent;
		}

		let defaultModel: { provider: string; id: string; name: string; vision?: boolean } | undefined;
		if (body.defaultModel) {
			const models = await listAvailableModels();
			const matched = models.find(
				(model) => model.provider === body.defaultModel?.provider && model.id === body.defaultModel.id,
			);
			if (!matched) return c.json(apiError("Unknown or unavailable model", "VALIDATION_ERROR"), 422);
			defaultModel = {
				provider: matched.provider,
				id: matched.id,
				name: matched.name,
				vision: matched.vision === true,
			};
		}

		let visionModel: { provider: string; id: string; name: string; vision: true } | null | undefined;
		if (body.visionModel === null) {
			visionModel = null;
		} else if (body.visionModel !== undefined) {
			const models = await listAvailableModels();
			const matched = models.find(
				(model) => model.provider === body.visionModel?.provider && model.id === body.visionModel.id,
			);
			if (!matched) return c.json(apiError("Unknown or unavailable vision model", "VALIDATION_ERROR"), 422);
			if (!matched.vision) {
				return c.json(apiError("The selected model does not support image input", "VALIDATION_ERROR"), 422);
			}
			visionModel = { provider: matched.provider, id: matched.id, name: matched.name, vision: true };
		}

		return c.json(await savePreferences({ defaultAgent, defaultModel, visionModel }));
	});

	app.get("/api/providers", async (c) => c.json({ providers: await listProviderStatuses() }));

	app.put("/api/providers/:provider/api-key", async (c) => {
		try {
			const body = await c.req.json<{ apiKey?: string }>().catch(() => undefined);
			if (!body?.apiKey) return c.json(apiError("apiKey is required", "VALIDATION_ERROR"), 422);
			await saveProviderApiKey(c.req.param("provider"), body.apiKey);
			return c.json({ ok: true, providers: await listProviderStatuses() });
		} catch (error) {
			return handleSessionError(c, error);
		}
	});

	app.delete("/api/providers/:provider/api-key", async (c) => {
		try {
			await deleteProviderApiKey(c.req.param("provider"));
			return c.json({ ok: true, providers: await listProviderStatuses() });
		} catch (error) {
			return handleSessionError(c, error);
		}
	});

	app.post("/api/providers/:provider/models/refresh", async (c) => {
		const provider = c.req.param("provider");
		try {
			return c.json({ ok: true, models: await refreshProviderModels(provider) });
		} catch (error) {
			// Discovery is additive: retain the provider's last-known capability
			// catalog and report a non-fatal warning to the settings UI.
			const available = (await listAvailableModels()).filter((model) => model.provider === provider);
			return c.json({
				ok: false,
				models: available,
				warning: error instanceof Error ? error.message : "Model discovery failed",
			});
		}
	});

	app.post("/api/providers/:provider/oauth", (c) => {
		try {
			return c.json(providerOAuth.start(c.req.param("provider")), 202);
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to start OAuth login", "OAUTH_UNSUPPORTED"),
				422,
			);
		}
	});

	app.delete("/api/providers/:provider/oauth", async (c) => {
		try {
			await providerOAuth.logout(c.req.param("provider"));
			return c.json({ ok: true, providers: await listProviderStatuses() });
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to log out", "OAUTH_LOGOUT_FAILED"),
				422,
			);
		}
	});

	app.get("/api/provider-oauth/:id", (c) => {
		const job = providerOAuth.get(c.req.param("id"));
		return job ? c.json(job) : c.json(apiError("OAuth login job not found", "NOT_FOUND"), 404);
	});

	app.post("/api/provider-oauth/:id/respond", async (c) => {
		const body = await c.req.json<{ promptId?: unknown; value?: unknown }>().catch(() => undefined);
		if (!body || typeof body.promptId !== "string" || typeof body.value !== "string") {
			return c.json(apiError("promptId and value are required", "VALIDATION_ERROR"), 422);
		}
		try {
			return c.json(providerOAuth.respond(c.req.param("id"), body.promptId, body.value));
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to answer OAuth prompt", "OAUTH_PROMPT_FAILED"),
				409,
			);
		}
	});

	app.delete("/api/provider-oauth/:id", (c) => {
		try {
			return c.json(providerOAuth.cancel(c.req.param("id")));
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to cancel OAuth login", "NOT_FOUND"),
				404,
			);
		}
	});

	app.get("/project", async (c) => {
		const current = await resolveWorkspaceInstance(process.env.DEEPSCIENCE_INITIAL_WORKSPACE);
		await registerWorkspaceInstance(current);
		return c.json(await listWorkspaceProjects());
	});
	app.get("/project/current", async (c) => {
		const current = await resolveWorkspaceInstance(process.env.DEEPSCIENCE_INITIAL_WORKSPACE);
		const project = await registerWorkspaceInstance(current);
		return c.json({ ...project, directory: current.directory, workspaceKind: current.workspaceKind });
	});
	app.get("/project/directories", async (c) => {
		try {
			return c.json(
				await browseWorkspaceDirectories(
					c.req.query("path") ?? process.env.DEEPSCIENCE_INITIAL_WORKSPACE ?? process.cwd(),
				),
			);
		} catch (error) {
			return c.json(
				apiError(
					error instanceof Error ? error.message : "Unable to browse directories",
					"DIRECTORY_BROWSE_FAILED",
				),
				400,
			);
		}
	});
	app.post("/project", async (c) => {
		const body = await c.req.json<{ directory?: string; create?: boolean }>().catch(() => undefined);
		if (!body?.directory?.trim()) {
			return c.json(apiError("directory is required", "VALIDATION_ERROR"), 422);
		}
		try {
			return c.json(
				await openWorkspaceProject(body.directory.trim(), body.create === true),
				body.create ? 201 : 200,
			);
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to open workspace", "WORKSPACE_OPEN_FAILED"),
				400,
			);
		}
	});

	app.get("/api/worktrees", async (c) => {
		try {
			return c.json({ worktrees: await listGitWorktrees(c.req.query("directory") ?? process.cwd()) });
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to list worktrees", "WORKTREE_ERROR"),
				400,
			);
		}
	});
	app.post("/api/worktrees", async (c) => {
		try {
			const body = await c.req.json<{ directory?: string; name?: string; branch?: string; baseRef?: string }>();
			if (!body.name) return c.json(apiError("name is required", "VALIDATION_ERROR"), 422);
			const instance = await createGitWorktree({
				directory: body.directory ?? process.cwd(),
				name: body.name,
				branch: body.branch,
				baseRef: body.baseRef,
			});
			return c.json(instance, 201);
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to create worktree", "WORKTREE_ERROR"),
				400,
			);
		}
	});
	app.delete("/api/worktrees", async (c) => {
		try {
			const body = await c.req.json<{ directory?: string; force?: boolean }>();
			if (!body.directory) return c.json(apiError("directory is required", "VALIDATION_ERROR"), 422);
			await removeGitWorktree(body.directory, body.force === true);
			return c.json({ ok: true });
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to remove worktree", "WORKTREE_ERROR"),
				400,
			);
		}
	});

	app.get("/config", (c) =>
		c.json({
			username: "scientist",
			permission: {},
			agent: {},
			experimental: {},
		}),
	);
	app.get("/config/providers", (c) => c.json([]));

	app.get("/agent", async (c) => {
		const agents = await listAgents();
		return c.json(
			agents.map((a) => ({
				name: a.name,
				description: a.description,
				color: a.color,
				mode: a.mode,
				native: true,
				permission: [],
				options: {},
			})),
		);
	});

	app.get("/provider", (c) => c.json([]));
	app.get("/provider/auth", (c) => c.json([]));

	app.get("/session", async (c) => c.json(await listSessions(c.req.query("directory"))));
	app.get("/session/status", (c) => c.json({}));

	app.get("/api/skills", async (c) => {
		const sessionID = c.req.query("session_id");
		const managed = sessionID ? await getSession(sessionID) : undefined;
		if (sessionID && !managed) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		const state = sessionID ? await getSessionSkillState(sessionID) : undefined;
		const agentConfig = managed ? await getAgentConfig(managed.agentName) : undefined;
		const isVisible = (skill: SkillCatalogEntry): boolean =>
			agentConfig ? isSkillVisibleForRuleset(skill, agentConfig.permission) : true;
		const limitText = c.req.query("limit");
		const requestedLimit = limitText ? Number(limitText) : 500;
		const limit = Number.isFinite(requestedLimit) ? requestedLimit : 500;
		const sourceText = c.req.query("source");
		const source = isSkillSourceId(sourceText) ? sourceText : undefined;
		const directoryOnly = c.req.query("directory_only") === "true";
		const skills = directoryOnly
			? []
			: (
					await skillCatalog.list({
						query: c.req.query("q"),
						category: c.req.query("category"),
						source,
						limit: 5_000,
					})
				)
					.filter(isVisible)
					.slice(0, limit);
		const loaded = new Set(state?.loaded ?? []);
		const stats = await skillCatalog.getStats();
		const visibleSkills = (await skillCatalog.list({ limit: 5_000 })).filter(isVisible);
		const directorySkills = source ? visibleSkills.filter((skill) => skill.source === source) : visibleSkills;
		const topCounts = new Map<string, number>();
		const pathCounts = new Map<string, number>();
		for (const skill of directorySkills) {
			topCounts.set(skill.category, (topCounts.get(skill.category) ?? 0) + 1);
			const path = skill.categoryPath.join("/");
			pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
		}
		const categories = [...topCounts.keys(), ...[...pathCounts.keys()].filter((path) => path.includes("/"))].sort();
		const categoryTree = [...topCounts]
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.map(([name, count]) => ({
				name,
				path: name,
				count,
				children: [...pathCounts]
					.filter(([path]) => path.startsWith(`${name}/`))
					.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
					.map(([path, childCount]) => ({
						name: path.split("/").at(-1) ?? path,
						path,
						count: childCount,
					})),
			}));
		const sourceCounts = new Map<SkillSourceId, number>();
		for (const skill of visibleSkills) sourceCounts.set(skill.source, (sourceCounts.get(skill.source) ?? 0) + 1);
		const sources = stats.sources
			.map((item) => ({ ...item, count: sourceCounts.get(item.id) ?? 0 }))
			.filter((item) => item.count > 0);
		return c.json({
			skills: skills.map((skill) => ({ ...skill, loaded: loaded.has(skill.name) })),
			categories,
			categoryTree,
			total: visibleSkills.length,
			loaded: [...loaded],
			sources,
			duplicates: stats.duplicates,
		});
	});

	app.get("/api/skills/diagnostics", async (c) => {
		const diagnostics = await skillCatalog.getDiagnostics();
		const stats = await skillCatalog.getStats();
		return c.json({ diagnostics, count: diagnostics.length, stats, usage: await readSkillUsage() });
	});

	app.post("/api/skills/refresh", async (c) => {
		await skillCatalog.reload();
		const stats = await skillCatalog.getStats();
		const diagnostics = await skillCatalog.getDiagnostics();
		return c.json({ ok: true, total: stats.total, duplicates: stats.duplicates, diagnostics: diagnostics.length });
	});

	app.get("/api/skills/usage", async (c) => c.json({ usage: await readSkillUsage() }));

	for (const kind of ["user", "learned"] as const) {
		app.post(`/api/skills/${kind}`, async (c) => {
			try {
				const body = await c.req.json<ManagedSkillInput>();
				const filePath = await saveManagedSkill(kind, body);
				await skillCatalog.reload();
				const skill = await skillCatalog.get(body.name);
				return c.json({ ok: true, filePath, skill }, 201);
			} catch (error) {
				return c.json(apiError(error instanceof Error ? error.message : "Invalid skill", "SKILL_INVALID"), 422);
			}
		});

		app.delete(`/api/skills/${kind}/:name`, async (c) => {
			try {
				const deleted = await deleteManagedSkill(kind, c.req.param("name"));
				if (!deleted) return c.json(apiError("Skill not found", "NOT_FOUND"), 404);
				await skillCatalog.reload();
				return c.json({ ok: true });
			} catch (error) {
				return c.json(
					apiError(error instanceof Error ? error.message : "Unable to delete skill", "SKILL_DELETE_FAILED"),
					422,
				);
			}
		});
	}

	app.post("/api/skills/installed", async (c) => {
		try {
			const body = await c.req.json<{ url?: string }>();
			if (!body.url) return c.json(apiError("url is required", "VALIDATION_ERROR"), 422);
			const installed = await installSkillSource(body.url);
			await skillCatalog.reload();
			return c.json({ ok: true, installed }, 201);
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to install skills", "SKILL_INSTALL_FAILED"),
				422,
			);
		}
	});

	app.delete("/api/skills/installed/:id", async (c) => {
		try {
			const deleted = await deleteInstalledSkillSource(c.req.param("id"));
			if (!deleted) return c.json(apiError("Installed source not found", "NOT_FOUND"), 404);
			await skillCatalog.reload();
			return c.json({ ok: true });
		} catch (error) {
			return c.json(
				apiError(error instanceof Error ? error.message : "Unable to remove skills", "SKILL_DELETE_FAILED"),
				422,
			);
		}
	});

	app.get("/api/skills/:name", async (c) => {
		const metadata = await skillCatalog.find(c.req.param("name"));
		if (!metadata) return c.json(apiError("Skill not found", "NOT_FOUND"), 404);
		const sessionID = c.req.query("session_id");
		const managed = sessionID ? await getSession(sessionID) : undefined;
		if (sessionID && !managed) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		const agentConfig = managed ? await getAgentConfig(managed.agentName) : undefined;
		if (agentConfig && !isSkillVisibleForRuleset(metadata, agentConfig.permission)) {
			return c.json(apiError("Skill is not available to this session agent", "PERMISSION_DENIED"), 403);
		}
		const skill = await skillCatalog.get(metadata.name);
		if (!skill) return c.json(apiError("Skill not found", "NOT_FOUND"), 404);
		const state = sessionID ? await getSessionSkillState(sessionID) : undefined;
		return c.json({ skill: { ...skill, loaded: state?.loaded.includes(skill.name) ?? false } });
	});

	app.get("/api/workspace/files", async (c) => {
		const sessionID = c.req.query("session_id") ?? c.req.query("session_key");
		const root = await resolveRequestWorkspace(sessionID, c.req.query("directory"));
		if (!root) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		try {
			return c.json(await listWorkspaceFiles(c.req.query("path") ?? "", root));
		} catch (error) {
			if (error instanceof WorkspacePathError) {
				return c.json(apiError(error.message, "INVALID_PATH"), 400);
			}
			return c.json(apiError("Unable to list workspace files", "WORKSPACE_ERROR"), 500);
		}
	});

	app.get("/api/workspace/file", async (c) => {
		const sessionID = c.req.query("session_id") ?? c.req.query("session_key");
		const root = await resolveRequestWorkspace(sessionID, c.req.query("directory"));
		if (!root) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		try {
			return c.json(await previewWorkspaceFile(c.req.query("path") ?? "", root));
		} catch (error) {
			if (error instanceof WorkspacePathError) {
				return c.json(apiError(error.message, "INVALID_PATH"), 400);
			}
			return c.json(apiError("Unable to preview workspace file", "WORKSPACE_ERROR"), 500);
		}
	});

	app.get("/api/workspace/file/raw", async (c) => {
		const root = await resolveRequestWorkspace(
			c.req.query("session_id") ?? c.req.query("session_key"),
			c.req.query("directory"),
		);
		if (!root) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return serveArtifactContentFromRoot(c, root);
	});

	app.post("/session", async (c) => {
		const body = await c.req.json<{
			title?: string;
			agent?: string;
			model?: { provider: string; id: string };
			directory?: string;
			thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
		}>();
		const agentName = body.agent ?? "biology";
		try {
			const info = await createSession(agentName, body.model, body.directory, body.thinkingLevel ?? "medium");
			return c.json(info, 201);
		} catch (err) {
			return handleSessionError(c, err);
		}
	});

	app.get("/session/:id", async (c) => {
		const managed = await getSession(c.req.param("id"));
		if (!managed) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(managed.info);
	});

	app.delete("/session/:id", async (c) => {
		const id = c.req.param("id");
		const deleted = await deleteSession(id);
		if (!deleted) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json({ ok: true });
	});

	app.get("/session/:id/message", async (c) => {
		const managed = await getSession(c.req.param("id"));
		if (!managed) return c.json([]);

		const sidecar = managed.sidecar;
		const order = sidecar.messageOrder ?? [];
		const messages = managed.agent.state.messages;

		const result = [];
		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			const msgId = order[i];
			if (!msgId) continue;
			const meta = sidecar.messages?.[msgId];
			if (!meta) continue;

			if (msg.role === "user") {
				const content =
					typeof msg.content === "string" ? [{ type: "text" as const, text: msg.content }] : msg.content;
				const parts = (content ?? [])
					.map((c, contentIndex) => {
						if (c.type === "text") {
							const textIndex = content.slice(0, contentIndex).filter((block) => block.type === "text").length;
							const partId = findPartId(sidecar, msgId, "text", textIndex);
							return {
								id: partId,
								type: "text",
								text: (c as { text?: string }).text ?? "",
								synthetic: sidecar.parts?.[partId]?.synthetic ?? false,
							};
						}
						if (c.type === "image") {
							const image = c as { data?: string; mimeType?: string; name?: string; path?: string };
							const imageIndex = contentIndex;
							const partId = findPartId(sidecar, msgId, "image", 0, imageIndex);
							return {
								id: partId,
								type: "image",
								data: image.data ?? "",
								mimeType: image.mimeType ?? "application/octet-stream",
								name: image.name ?? sidecar.parts?.[partId]?.name,
								path: image.path ?? sidecar.parts?.[partId]?.path,
								synthetic: false,
							};
						}
						return null;
					})
					.filter((part) => part !== null);
				result.push({
					info: {
						id: msgId,
						role: "user",
						sessionID: managed.info.id,
						time: { created: meta.createdAt },
					},
					parts,
				});
			} else if (msg.role === "assistant") {
				const assistant = msg as {
					content: Array<{
						type: string;
						text?: string;
						thinking?: string;
						redacted?: boolean;
						id?: string;
						name?: string;
					}>;
				};
				const parts = assistant.content
					.map((c, contentIndex) => {
						if (c.type === "text") {
							const textIndex = assistant.content
								.slice(0, contentIndex)
								.filter((block) => block.type === "text").length;
							const partId = findPartId(sidecar, msgId, "text", textIndex);
							return {
								id: partId,
								type: "text",
								text: c.text ?? "",
								phase: sidecar.parts?.[partId]?.phase ?? "process",
								synthetic: false,
							};
						}
						if (c.type === "thinking") {
							const thinkingIndex = assistant.content
								.slice(0, contentIndex)
								.filter((block) => block.type === "thinking").length;
							const partId = findPartId(sidecar, msgId, "thinking", thinkingIndex);
							return {
								id: partId,
								type: "thinking",
								text: c.thinking ?? "",
								redacted: c.redacted ?? sidecar.parts?.[partId]?.redacted ?? false,
								synthetic: false,
							};
						}
						return null;
					})
					.filter(Boolean);
				result.push({
					info: {
						id: msgId,
						role: "assistant",
						sessionID: managed.info.id,
						agent: meta.agent ?? managed.agentName,
						modelID: meta.modelID ?? managed.info.model.id,
						providerID: meta.providerID ?? managed.info.model.provider,
						stopReason: meta.stopReason,
						errorMessage: meta.errorMessage,
						time: { created: meta.createdAt },
					},
					parts,
				});
			} else if (msg.role === "toolResult") {
				const tool = msg as { toolName?: string; toolCallId?: string; isError?: boolean; content?: unknown[] };
				const content = normalizeToolResultContent(tool.content);
				const partId = findPartId(sidecar, msgId, "tool", 0);
				result.push({
					info: {
						id: msgId,
						role: "tool",
						sessionID: managed.info.id,
						time: { created: meta.createdAt },
					},
					parts: [
						{
							id: partId,
							type: "tool",
							tool: tool.toolName ?? "unknown",
							callId: tool.toolCallId ?? "",
							state: { status: tool.isError ? "error" : "completed" },
							content,
							details: sidecar.parts?.[partId]?.details,
							output: summarizeToolResultContent(content, 8000),
							synthetic: false,
						},
					],
				});
			}
		}
		return c.json(result);
	});

	app.post("/session/:id/message", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json<{
			message?: string;
			images?: unknown;
			agent?: string;
			model?: { provider: string; id: string };
		}>();
		const managed = await getSession(id);
		if (!managed) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		let images: ReturnType<typeof normalizePromptImages>;
		try {
			images = normalizePromptImages(body.images);
		} catch (error) {
			if (error instanceof PromptImageValidationError) {
				return c.json(apiError(error.message, "INVALID_IMAGE"), 422);
			}
			throw error;
		}
		if (!(body.message ?? "").trim() && images.length === 0) {
			return c.json(apiError("A message or image is required", "VALIDATION_ERROR"), 422);
		}
		const reservation = reserveSessionPrompt(managed);
		if (!reservation) return c.json(apiError("Session is busy", "BUSY"), 409);

		c.header("Content-Type", "text/event-stream");
		c.header("Cache-Control", "no-cache");
		c.header("Connection", "keep-alive");

		return stream(c, async (s) => {
			let aborted = false;
			s.onAbort(() => {
				aborted = true;
				void abortSessionAndWait(id);
			});
			try {
				const result = await runSessionPrompt(id, body.message ?? "", {
					reservation,
					images,
					onEvent: async (event) => {
						await s.write(sseFormat(event));
					},
				});
				if (result.errorMessage) {
					s.write(sseFormat({ type: "error", message: result.errorMessage }));
				}
			} catch (err) {
				releaseSessionPrompt(id, reservation);
				console.error("[prompt error]", err);
				const msg = err instanceof Error ? err.message : String(err);
				s.write(sseFormat({ type: "error", message: msg }));
			}
			if (!aborted) s.write(sseFormat({ type: "done" }));
		});
	});

	app.post("/session/:id/prompt_async", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json<{ message?: string; images?: unknown }>();
		const managed = await getSession(id);
		if (!managed) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		let images: ReturnType<typeof normalizePromptImages>;
		try {
			images = normalizePromptImages(body.images);
		} catch (error) {
			if (error instanceof PromptImageValidationError) {
				return c.json(apiError(error.message, "INVALID_IMAGE"), 422);
			}
			throw error;
		}
		if (!(body.message ?? "").trim() && images.length === 0) {
			return c.json(apiError("A message or image is required", "VALIDATION_ERROR"), 422);
		}
		const reservation = reserveSessionPrompt(managed);
		if (!reservation) return c.json(apiError("Session is busy", "BUSY"), 409);
		runSessionPrompt(id, body.message ?? "", { reservation, images }).catch((error) => {
			console.error("[async prompt]", error);
			releaseSessionPrompt(id, reservation);
		});
		return c.json({ ok: true }, 202);
	});

	app.patch("/session/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json<{
			model?: { provider: string; id: string };
			thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
		}>();
		if (body.model) {
			try {
				const info = await updateSessionModel(id, body.model);
				if (!info) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
				return c.json(info);
			} catch (error) {
				return handleSessionError(c, error);
			}
		}
		const managed = await getSession(id);
		if (!managed) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		if (body.thinkingLevel) {
			try {
				return c.json(await updateSessionThinkingLevel(id, body.thinkingLevel));
			} catch (error) {
				return handleSessionError(c, error);
			}
		}
		return c.json(managed.info);
	});

	app.post("/session/:id/abort", async (c) => {
		const id = c.req.param("id");
		const aborted = await abortSessionAndWait(id);
		if (!aborted) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json({ ok: true });
	});

	app.get("/session/:id/children", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		return c.json(await listChildSessions(id));
	});

	app.post("/session/:id/child", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json<{
			agent?: string;
			model?: { provider: string; id: string };
			title?: string;
		}>();
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const result = await createChildSession(id, body.agent, body.model, body.title);
		if (!result) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(result, 201);
	});

	app.post("/session/:id/fork", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json<{ messageID?: string }>().catch(() => ({}) as { messageID?: string });
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		if (body.messageID && !isValidMessageId(body.messageID)) {
			return c.json(apiError("Invalid message id", "INVALID_ID"), 400);
		}
		try {
			const result = await forkSession(id, body.messageID);
			if (!result) return c.json(apiError("Session or message not found", "NOT_FOUND"), 404);
			return c.json(result, 201);
		} catch (error) {
			return handleSessionError(c, error);
		}
	});

	app.post("/session/:id/revert", async (c) => {
		const id = c.req.param("id");
		const body = await c.req
			.json<{ messageID?: string; partID?: string }>()
			.catch(() => ({}) as { messageID?: string; partID?: string });
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		if (!body.messageID || !isValidMessageId(body.messageID)) {
			return c.json(apiError("messageID is required", "INVALID_ID"), 400);
		}
		if (body.partID && !isValidPartId(body.partID)) {
			return c.json(apiError("Invalid part id", "INVALID_ID"), 400);
		}
		try {
			const result = await revertSession(id, body.messageID, body.partID);
			if (!result) return c.json(apiError("Session or message not found", "NOT_FOUND"), 404);
			return c.json(result);
		} catch (err) {
			return handleSessionError(c, err);
		}
	});

	app.post("/session/:id/unrevert", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		try {
			const result = await unrevertSession(id);
			if (!result) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
			return c.json(result);
		} catch (err) {
			return handleSessionError(c, err);
		}
	});

	app.get("/session/:id/todo", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const result = await getSessionTodos(id);
		if (result === undefined) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(result);
	});

	app.get("/session/:id/skills", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const result = await getSessionSkillState(id);
		if (!result) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(result);
	});

	app.get("/session/:id/resources", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const result = await getSessionResourceState(id);
		if (!result) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(result);
	});

	app.put("/session/:id/todo", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const body = await c.req.json<unknown>();
		try {
			const result = await setSessionTodos(id, body);
			if (result === undefined) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
			return c.json(result);
		} catch (err) {
			if (err instanceof ValidationError) {
				return c.json(apiError(err.message, "VALIDATION_ERROR"), 422);
			}
			return handleSessionError(c, err);
		}
	});

	app.get("/session/:id/diff", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const messageID = c.req.query("messageID");
		if (messageID && !isValidMessageId(messageID)) {
			return c.json(apiError("Invalid message id", "INVALID_ID"), 400);
		}
		const result = await getSessionDiffs(id, messageID);
		if (result === undefined) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(result);
	});

	app.put("/session/:id/diff", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const body = await c.req.json<unknown>();
		try {
			const result = await setSessionDiffs(id, body);
			if (result === undefined) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
			return c.json(result);
		} catch (err) {
			if (err instanceof ValidationError) {
				return c.json(apiError(err.message, "VALIDATION_ERROR"), 422);
			}
			return handleSessionError(c, err);
		}
	});

	app.get("/session/:id/summary", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const result = await getSessionSummary(id);
		if (result === undefined) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
		return c.json(result);
	});

	app.post("/session/:id/summarize", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const body = await c.req.json<{ summary?: string }>().catch(() => ({}) as { summary?: string });
		try {
			const result = await summarizeSession(id, body.summary);
			if (!result) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
			return c.json(result);
		} catch (err) {
			if (err instanceof ValidationError) {
				return c.json(apiError(err.message, "VALIDATION_ERROR"), 422);
			}
			return handleSessionError(c, err);
		}
	});

	app.post("/session/:id/compact", async (c) => {
		const id = c.req.param("id");
		if (!isValidSessionId(id)) return c.json(apiError("Invalid session id", "INVALID_ID"), 400);
		const body = await c.req
			.json<{ summary?: string; recentTurnRetention?: number }>()
			.catch(() => ({}) as { summary?: string; recentTurnRetention?: number });
		try {
			const result = await compactSession(id, {
				suppliedSummary: body.summary,
				recentTurnRetention: body.recentTurnRetention,
			});
			if (!result) return c.json(apiError("Session not found", "NOT_FOUND"), 404);
			return c.json(result);
		} catch (err) {
			if (err instanceof ValidationError) {
				return c.json(apiError(err.message, "VALIDATION_ERROR"), 422);
			}
			return handleSessionError(c, err);
		}
	});

	app.post("/session/:id/init", (c) => c.json({ ok: true }));

	app.get("/global/event", (c) => {
		c.header("Content-Type", "text/event-stream");
		c.header("Cache-Control", "no-cache");
		c.header("Connection", "keep-alive");
		return stream(c, async (s) => {
			s.write(": heartbeat\n\n");
			const interval = setInterval(() => s.write(": heartbeat\n\n"), 30000);
			s.onAbort(() => {
				clearInterval(interval);
			});
			await new Promise<void>((resolve) => {
				s.onAbort(() => resolve());
			});
			clearInterval(interval);
		});
	});

	app.get("/event", (c) => {
		c.header("Content-Type", "text/event-stream");
		c.header("Cache-Control", "no-cache");
		c.header("Connection", "keep-alive");
		return stream(c, async (s) => {
			s.write(": heartbeat\n\n");
			const interval = setInterval(() => s.write(": heartbeat\n\n"), 30000);
			s.onAbort(() => {
				clearInterval(interval);
			});
			await new Promise<void>((resolve) => {
				s.onAbort(() => resolve());
			});
			clearInterval(interval);
		});
	});

	app.get("/file", (c) => c.json([]));
	app.get("/file/content", (c) => c.text(""));
	app.get("/file/status", (c) => c.json({}));

	app.get("/command", (c) => c.json([]));

	app.get("/find", (c) => c.json([]));
	app.get("/find/file", (c) => c.json([]));
	app.get("/find/symbol", (c) => c.json([]));

	app.get("/pty", (c) => c.json([]));

	app.get("/vcs", (c) => c.json({}));

	app.get("/path", (c) => c.json({ path: process.cwd() }));

	app.post("/instance/dispose", (c) => c.json({ ok: true }));

	app.get("/mcp", (c) => c.json({}));
	app.get("/lsp", (c) => c.json({}));
	app.get("/formatter", (c) => c.json({}));

	app.get("/experimental/tool", (c) => c.json([]));
	app.get("/experimental/tool/ids", (c) => c.json([]));

	app.post("/log", (c) => c.json({ ok: true }));

	app.get("/api/models", async (c) => {
		const models = await listAvailableModels();
		const grouped: Record<string, (typeof models)[number][]> = {};
		for (const m of models) {
			if (!grouped[m.provider]) grouped[m.provider] = [];
			grouped[m.provider].push(m);
		}
		return c.json(grouped);
	});

	app.get("/api/agents", async (c) => {
		const agents = await listAgents();
		return c.json(agents.map((a) => ({ name: a.name, description: a.description, color: a.color })));
	});
}

function handleSessionError(c: { json: (body: object, status?: number) => Response }, err: unknown): Response {
	if (err instanceof ModelConfigurationError) {
		return c.json(
			apiError(err.message, err.code, {
				...(err.provider ? { provider: err.provider } : {}),
				...(err.modelID ? { model: err.modelID } : {}),
				...(err.providerName ? { providerName: err.providerName } : {}),
			}),
			409,
		);
	}
	if (err instanceof BusyError) {
		return c.json(apiError(err.message, "BUSY"), 409);
	}
	if (err instanceof NotFoundError) {
		return c.json(apiError(err.message, "NOT_FOUND"), 404);
	}
	if (err instanceof ValidationError) {
		return c.json(apiError(err.message, "VALIDATION_ERROR"), 422);
	}
	return c.json(apiError(err instanceof Error ? err.message : "Unknown error", "SESSION_ERROR"), 500);
}

function isSkillVisibleForRuleset(skill: SkillCatalogEntry, ruleset: Ruleset): boolean {
	return (
		evaluate("skill", skill.name, ruleset).action !== "deny" &&
		evaluate("skill.category", skill.categoryPath.join("/"), ruleset).action !== "deny"
	);
}

function findPartId(
	sidecar: SessionSidecar,
	messageID: string,
	type: "text" | "thinking" | "tool" | "image",
	index: number,
	imageIndex?: number,
): string {
	const part = Object.values(sidecar.parts ?? {}).filter(
		(candidate) =>
			candidate.messageID === messageID &&
			candidate.type === type &&
			(type !== "image" || imageIndex === undefined || candidate.imageIndex === imageIndex),
	)[index];
	return part?.id ?? `part_${messageID}_${type}_${index}`;
}
