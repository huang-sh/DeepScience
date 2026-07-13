#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listAgents } from "@shying/ds-science";
import { parseCliArgs } from "./cli-args.ts";
import { runTui } from "./cli-tui.ts";
import { readPreferences } from "./preferences.ts";
import {
	createSession,
	getSession,
	listAvailableModels,
	listSessions,
	runSessionPrompt,
	updateSessionModel,
	updateSessionThinkingLevel,
} from "./session.ts";
import type { SessionInfo } from "./session-store.ts";

const VERSION = "0.0.1";

const HELP = `DeepScience CLI ${VERSION}

Usage:
  deepscience                         Open the interactive TUI
  deepscience web                     Start the API and WebUI
  deepscience "task"                  Open the TUI and run a task
  deepscience -p "task"               Run once and print the final result

Options:
  -a, --agent <name>                  Agent: research, biology, physics, ml
  -m, --model <provider/model>        Use a configured pi-ai model
      --thinking <level>              off|minimal|low|medium|high|xhigh (default: medium)
      --project <path>                Project root (default: current directory)
  -s, --session <id>                  Resume a session
  -c, --continue                      Resume the latest session for this project
  -p, --print                         Non-interactive output
      --list-agents                   List primary agents
      --list-models                   List models whose provider has credentials
      --list-sessions                 List saved sessions
  -h, --help                          Show help
  -v, --version                       Show version

TUI commands: /help, /status, /clear, /stop, /exit`;

async function runWeb(): Promise<void> {
	const initialWorkspace = process.cwd();
	const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const serverEntry = join(packageRoot, "dist", "index.js");
	try {
		await access(serverEntry);
	} catch {
		throw new Error(`Built Web server not found: ${serverEntry}. Run npm run build first.`);
	}
	await new Promise<void>((resolveRun, rejectRun) => {
		const child = spawn(process.execPath, [serverEntry], {
			cwd: packageRoot,
			stdio: "inherit",
			env: {
				...process.env,
				DEEPSCIENCE_INITIAL_WORKSPACE: initialWorkspace,
				DEEPSCIENCE_WEB_ROOT: "dist/public",
			},
		});
		child.once("error", rejectRun);
		child.once("exit", (code, signal) => {
			if (signal === "SIGINT") process.exitCode = 130;
			else if (signal === "SIGTERM") process.exitCode = 143;
			else process.exitCode = code ?? 1;
			resolveRun();
		});
	});
}

function modelKey(model: { provider: string; id: string }): string {
	return `${model.provider}/${model.id}`;
}

async function stdinText(): Promise<string | undefined> {
	if (process.stdin.isTTY) return undefined;
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf8").trim() || undefined;
}

async function resolveSession(options: ReturnType<typeof parseCliArgs>): Promise<SessionInfo> {
	if (options.session) {
		const managed = await getSession(options.session);
		if (!managed) throw new Error(`Session not found: ${options.session}`);
		if (options.agent && options.agent !== managed.info.agentName) {
			throw new Error(
				`Session ${options.session} uses agent ${managed.info.agentName}; its agent cannot be changed`,
			);
		}
		if (options.model) await updateSessionModel(options.session, options.model);
		if (options.thinkingSpecified && options.thinking !== (managed.info.thinkingLevel ?? "medium")) {
			await updateSessionThinkingLevel(options.session, options.thinking);
		}
		return managed.info;
	}

	if (options.continueSession) {
		const project = resolve(options.project);
		const latest = (await listSessions()).find(
			(session) => Boolean(session.projectDirectory) && resolve(session.projectDirectory as string) === project,
		);
		if (!latest) throw new Error(`No saved session for project: ${project}`);
		const managed = await getSession(latest.id);
		if (!managed) throw new Error(`Session not found: ${latest.id}`);
		if (options.agent && options.agent !== managed.info.agentName) {
			throw new Error(`Session ${latest.id} uses agent ${managed.info.agentName}; its agent cannot be changed`);
		}
		if (options.model) await updateSessionModel(latest.id, options.model);
		if (options.thinkingSpecified && options.thinking !== (managed.info.thinkingLevel ?? "medium")) {
			await updateSessionThinkingLevel(latest.id, options.thinking);
		}
		return managed.info;
	}

	const preferences = await readPreferences();
	const agents = await listAgents();
	const agent = options.agent ?? preferences.defaultAgent ?? "biology";
	if (!agents.some((candidate) => candidate.name === agent)) throw new Error(`Unknown agent: ${agent}`);

	const availableModels = await listAvailableModels();
	let model = options.model;
	const requestedModel = model;
	if (requestedModel && !availableModels.some((candidate) => modelKey(candidate) === modelKey(requestedModel))) {
		throw new Error(`Model is unavailable or its provider has no API key: ${modelKey(requestedModel)}`);
	}
	const preferredModel = preferences.defaultModel;
	if (!model && preferredModel) {
		model = availableModels.find((candidate) => modelKey(candidate) === modelKey(preferredModel));
	}
	return createSession(agent, model, resolve(options.project), options.thinking);
}

async function main(): Promise<void> {
	const options = parseCliArgs(process.argv.slice(2));
	if (options.command === "web") {
		await runWeb();
		return;
	}
	if (options.help) {
		console.log(HELP);
		return;
	}
	if (options.version) {
		console.log(VERSION);
		return;
	}
	if (options.listAgents) {
		for (const agent of await listAgents()) console.log(agent.name);
		return;
	}
	if (options.listModels) {
		const models = await listAvailableModels();
		if (models.length === 0) console.log("No configured model providers.");
		else for (const model of models) console.log(`${model.provider}/${model.id}\t${model.name}`);
		return;
	}
	if (options.listSessions) {
		for (const session of await listSessions()) {
			console.log(`${session.id}\t${session.agentName}\t${modelKey(session.model)}\t${session.title}`);
		}
		return;
	}

	const piped = await stdinText();
	const prompt = options.prompt ?? piped;
	if (piped) options.print = true;
	if (options.print && !prompt) throw new Error("--print requires a task");
	if (!process.stdout.isTTY && !options.print) {
		console.log(HELP);
		return;
	}

	const session = await resolveSession(options);
	if (options.print) {
		const result = await runSessionPrompt(session.id, prompt as string);
		const output = result.finalText || result.processText;
		if (output) process.stdout.write(`${output}\n`);
		if (result.stopReason === "error" || result.errorMessage) {
			throw new Error(result.errorMessage ?? "Agent task failed");
		}
		if (result.stopReason === "aborted") process.exitCode = 130;
		return;
	}

	await runTui({ session, initialPrompt: prompt });
}

main().catch((error) => {
	console.error(`deepscience: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
