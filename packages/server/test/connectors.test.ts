import assert from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { deleteConnector, readConnectorCatalog, saveConnector, testConnector } from "../src/connectors.ts";

let root = "";
let previousDataDirectory: string | undefined;

before(async () => {
	root = await mkdtemp(join(tmpdir(), "deepscience-connectors-"));
	previousDataDirectory = process.env.DEEPSCIENCE_DATA_DIR;
	process.env.DEEPSCIENCE_DATA_DIR = join(root, "global-data");
});

after(async () => {
	if (previousDataDirectory === undefined) delete process.env.DEEPSCIENCE_DATA_DIR;
	else process.env.DEEPSCIENCE_DATA_DIR = previousDataDirectory;
	await rm(root, { recursive: true, force: true });
});

describe("global MCP Connectors", () => {
	it("stores lazy stdio and HTTP Connectors in the DeepScience data directory", async () => {
		await saveConnector("local-tools", {
			command: "npx",
			args: ["-y", "@example/mcp"],
			lifecycle: "lazy",
		});
		await saveConnector("remote-tools", {
			url: "https://example.org/mcp",
			auth: "oauth",
		});

		const catalog = await readConnectorCatalog();
		assert.strictEqual(catalog.exists, true);
		assert.strictEqual(catalog.configPath, join(root, "global-data", "mcp.json"));
		assert.deepStrictEqual(
			catalog.connectors.map((connector) => [connector.name, connector.transport, connector.lifecycle]),
			[
				["local-tools", "stdio", "lazy"],
				["remote-tools", "http", "lazy"],
			],
		);
		assert.strictEqual(catalog.connectors[1]?.auth, "oauth");
	});

	it("preserves advanced adapter settings while updating one Connector", async () => {
		await writeFile(
			join(root, "global-data", "mcp.json"),
			JSON.stringify({ settings: { sampling: false }, mcpServers: { existing: { command: "node" } } }),
		);
		await saveConnector("added", { url: "https://example.org/mcp" });
		const config = JSON.parse(await readFile(join(root, "global-data", "mcp.json"), "utf-8")) as {
			settings: { sampling: boolean };
			mcpServers: Record<string, unknown>;
		};
		assert.strictEqual(config.settings.sampling, false);
		assert.deepStrictEqual(Object.keys(config.mcpServers).sort(), ["added", "existing"]);
		assert.strictEqual(await deleteConnector("existing"), true);
		assert.strictEqual(await deleteConnector("missing"), false);
	});

	it("rejects ambiguous or unsafe definitions", async () => {
		await assert.rejects(
			saveConnector("ambiguous", { command: "node", url: "https://example.org/mcp" }),
			/exactly one transport/,
		);
		await assert.rejects(saveConnector("../unsafe", { command: "node" }), /Connector names/);
	});

	it("performs an MCP handshake and reports discovered tools before saving", async () => {
		const server = join(root, "mock-mcp.mjs");
		await writeFile(
			server,
			`import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result = {};
  if (request.method === "initialize") result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "connector-test", version: "1.0.0" } };
  if (request.method === "tools/list") result = { tools: [{ name: "echo", description: "Echo", inputSchema: { type: "object", properties: {} } }] };
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\\n");
});
`,
		);
		const result = await testConnector(root, "mock", {
			command: process.execPath,
			args: [server],
			requestTimeoutMs: 10_000,
		});
		assert.strictEqual(result.server.name, "connector-test");
		assert.strictEqual(result.toolCount, 1);
		assert.strictEqual(result.resourceCount, 0);
	});
});
