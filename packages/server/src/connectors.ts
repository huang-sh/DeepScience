import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type ConnectorLifecycle = "lazy" | "eager" | "keep-alive";

export interface ConnectorDefinition {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
	url?: string;
	headers?: Record<string, string>;
	auth?: "bearer" | "oauth" | false;
	oauth?: {
		grantType?: "authorization_code" | "client_credentials";
		clientId?: string;
		clientSecret?: string;
		scope?: string;
		redirectUri?: string;
	};
	bearerToken?: string;
	bearerTokenEnv?: string;
	lifecycle?: ConnectorLifecycle;
	idleTimeout?: number;
	requestTimeoutMs?: number;
	exposeResources?: boolean;
	excludeTools?: string[];
	debug?: boolean;
	[key: string]: unknown;
}

interface ConnectorConfig {
	mcpServers: Record<string, ConnectorDefinition>;
	settings?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface ConnectorSummary {
	name: string;
	transport: "stdio" | "http";
	command?: string;
	args?: string[];
	url?: string;
	lifecycle: ConnectorLifecycle;
	auth: "none" | "bearer" | "oauth";
	hasEnvironment: boolean;
	hasHeaders: boolean;
}

const CONNECTOR_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function connectorConfigPath(): string {
	return join(process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience"), "mcp.json");
}

export async function readConnectorCatalog(): Promise<{
	configPath: string;
	exists: boolean;
	connectors: ConnectorSummary[];
	diagnostics: Array<{ level: "info" | "warning"; message: string }>;
}> {
	const configPath = connectorConfigPath();
	const { config, exists } = await readConfig(configPath);
	const connectors = Object.entries(config.mcpServers)
		.map(([name, definition]) => summarizeConnector(name, definition))
		.sort((left, right) => left.name.localeCompare(right.name));
	const diagnostics: Array<{ level: "info" | "warning"; message: string }> = [];
	if (!exists)
		diagnostics.push({
			level: "info",
			message: "No global MCP configuration yet. Add a Connector to create ~/.deepscience/mcp.json.",
		});
	if (connectors.length === 0 && exists) {
		diagnostics.push({ level: "info", message: "The global MCP configuration contains no servers." });
	}
	return { configPath, exists, connectors, diagnostics };
}

export async function saveConnector(name: string, definition: ConnectorDefinition): Promise<void> {
	validateConnector(name, definition);
	const configPath = connectorConfigPath();
	const { config } = await readConfig(configPath);
	config.mcpServers[name] = definition;
	await writeConfig(configPath, config);
}

export async function deleteConnector(name: string): Promise<boolean> {
	if (!CONNECTOR_NAME.test(name)) return false;
	const configPath = connectorConfigPath();
	const { config, exists } = await readConfig(configPath);
	if (!exists || !(name in config.mcpServers)) return false;
	delete config.mcpServers[name];
	await writeConfig(configPath, config);
	return true;
}

export async function testConnector(
	projectDirectory: string,
	name: string,
	definition: ConnectorDefinition,
): Promise<{
	ok: true;
	server: { name?: string; version?: string };
	toolCount: number;
	resourceCount: number;
	durationMs: number;
}> {
	validateConnector(name, definition);
	const startedAt = Date.now();
	const timeout = normalizeTimeout(definition.requestTimeoutMs, 30_000);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error(`MCP test timed out after ${timeout}ms`)), timeout);
	const client = new Client({ name: "deepscience-connector-test", version: "0.0.2" });
	let transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | undefined;
	let stderr = "";
	try {
		if (definition.command) {
			const stdioTransport = new StdioClientTransport({
				command: definition.command,
				args: definition.args,
				cwd: resolveConnectorCwd(definition.cwd, projectDirectory),
				env: resolveEnvironment(definition.env),
				stderr: "pipe",
			});
			stdioTransport.stderr?.on("data", (chunk) => {
				if (stderr.length < 8_192) stderr += String(chunk);
			});
			transport = stdioTransport;
		} else {
			const requestInit = createRequestInit(definition);
			transport = new StreamableHTTPClientTransport(new URL(definition.url as string), { requestInit });
		}

		try {
			await client.connect(transport, { signal: controller.signal, timeout });
		} catch (error) {
			if (!definition.url || definition.auth === "oauth") throw error;
			await transport.close().catch(() => undefined);
			transport = new SSEClientTransport(new URL(definition.url), { requestInit: createRequestInit(definition) });
			await client.connect(transport, { signal: controller.signal, timeout });
		}

		const tools = await client.listTools(undefined, { signal: controller.signal, timeout });
		let resourceCount = 0;
		try {
			resourceCount = (await client.listResources(undefined, { signal: controller.signal, timeout })).resources
				.length;
		} catch {
			// Resources are optional in MCP.
		}
		const server = client.getServerVersion();
		return {
			ok: true,
			server: { name: server?.name, version: server?.version },
			toolCount: tools.tools.length,
			resourceCount,
			durationMs: Date.now() - startedAt,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const diagnostic = stderr.trim().slice(-4_000);
		throw new Error(diagnostic ? `${message}\n\nServer stderr:\n${diagnostic}` : message, { cause: error });
	} finally {
		clearTimeout(timer);
		await client.close().catch(() => undefined);
		await transport?.close().catch(() => undefined);
	}
}

function summarizeConnector(name: string, definition: ConnectorDefinition): ConnectorSummary {
	return {
		name,
		transport: definition.url ? "http" : "stdio",
		command: definition.command,
		args: definition.args,
		url: definition.url,
		lifecycle: definition.lifecycle ?? "lazy",
		auth:
			definition.auth === "oauth"
				? "oauth"
				: definition.auth === "bearer" || definition.bearerTokenEnv
					? "bearer"
					: "none",
		hasEnvironment: Boolean(definition.env && Object.keys(definition.env).length > 0),
		hasHeaders: Boolean(definition.headers && Object.keys(definition.headers).length > 0),
	};
}

export function validateConnector(name: string, definition: ConnectorDefinition): void {
	if (!CONNECTOR_NAME.test(name)) {
		throw new Error(
			"Connector names must start with a letter or number and contain only letters, numbers, ., _, or -",
		);
	}
	if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
		throw new Error("Connector definition must be an object");
	}
	const hasCommand = typeof definition.command === "string" && definition.command.trim().length > 0;
	const hasUrl = typeof definition.url === "string" && definition.url.trim().length > 0;
	if (hasCommand === hasUrl) throw new Error("Configure exactly one transport: command (stdio) or url (HTTP)");
	if (hasUrl) {
		const url = new URL(definition.url as string);
		if (!["http:", "https:"].includes(url.protocol)) throw new Error("Connector URL must use http or https");
	}
	if (definition.args && (!Array.isArray(definition.args) || definition.args.some((arg) => typeof arg !== "string"))) {
		throw new Error("Connector args must be an array of strings");
	}
	if (definition.lifecycle && !["lazy", "eager", "keep-alive"].includes(definition.lifecycle)) {
		throw new Error("Connector lifecycle must be lazy, eager, or keep-alive");
	}
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(value, 300_000) : fallback;
}

function resolveConnectorCwd(value: string | undefined, projectDirectory: string): string {
	if (!value?.trim()) return resolve(projectDirectory);
	const interpolated = interpolate(value);
	return resolve(projectDirectory, interpolated);
}

function interpolate(value: string): string {
	return value
		.replace(/\$\{(\w+)\}/g, (_, key: string) => process.env[key] ?? "")
		.replace(/\$env:(\w+)/g, (_, key: string) => process.env[key] ?? "");
}

function resolveEnvironment(values: Record<string, string> | undefined): Record<string, string> {
	const environment = Object.fromEntries(
		Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
	);
	for (const [key, value] of Object.entries(values ?? {})) environment[key] = interpolate(value);
	return environment;
}

function createRequestInit(definition: ConnectorDefinition): RequestInit | undefined {
	const headers = new Headers();
	let hasHeaders = false;
	for (const [key, value] of Object.entries(definition.headers ?? {})) {
		headers.set(key, interpolate(value));
		hasHeaders = true;
	}
	if (definition.auth === "bearer") {
		const token = definition.bearerToken
			? interpolate(definition.bearerToken)
			: definition.bearerTokenEnv
				? process.env[definition.bearerTokenEnv]
				: undefined;
		if (!token) throw new Error("Bearer authentication requires bearerToken or a configured bearerTokenEnv");
		headers.set("Authorization", `Bearer ${token}`);
		hasHeaders = true;
	}
	return hasHeaders ? { headers } : undefined;
}

async function readConfig(configPath: string): Promise<{ config: ConnectorConfig; exists: boolean }> {
	try {
		const parsed: unknown = JSON.parse(await readFile(configPath, "utf-8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			throw new Error("MCP config must be an object");
		const config = parsed as Partial<ConnectorConfig>;
		if (
			config.mcpServers !== undefined &&
			(!config.mcpServers || typeof config.mcpServers !== "object" || Array.isArray(config.mcpServers))
		) {
			throw new Error("mcpServers must be an object");
		}
		return { config: { ...config, mcpServers: config.mcpServers ?? {} } as ConnectorConfig, exists: true };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { config: { mcpServers: {} }, exists: false };
		throw error;
	}
}

async function writeConfig(configPath: string, config: ConnectorConfig): Promise<void> {
	await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
	const temporary = `${configPath}.${randomUUID()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
	await rename(temporary, configPath);
}
