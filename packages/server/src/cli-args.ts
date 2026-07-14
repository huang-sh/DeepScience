import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export interface CliOptions {
	command: "agent" | "web";
	help: boolean;
	version: boolean;
	print: boolean;
	listAgents: boolean;
	listModels: boolean;
	listSessions: boolean;
	continueSession: boolean;
	agent?: string;
	model?: { provider: string; id: string };
	thinking: ThinkingLevel;
	thinkingSpecified: boolean;
	project: string;
	port?: number;
	session?: string;
	prompt?: string;
}

const THINKING_LEVELS = new Set<ThinkingLevel>(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function readValue(args: string[], index: number, flag: string): string {
	const value = args[index + 1];
	if (!value || value.startsWith("-")) throw new Error(`${flag} requires a value`);
	return value;
}

export function parseCliArgs(args: string[], cwd = process.cwd()): CliOptions {
	const options: CliOptions = {
		command: "agent",
		help: false,
		version: false,
		print: false,
		listAgents: false,
		listModels: false,
		listSessions: false,
		continueSession: false,
		thinking: "medium",
		thinkingSpecified: false,
		project: cwd,
	};
	if (args[0] === "web") {
		options.command = "web";
		for (let index = 1; index < args.length; index++) {
			const arg = args[index];
			switch (arg) {
				case "-h":
				case "--help":
					options.help = true;
					break;
				case "-v":
				case "--version":
					options.version = true;
					break;
				case "--port": {
					const value = readValue(args, index, arg);
					const port = Number(value);
					if (!Number.isInteger(port) || port < 1 || port > 65_535) {
						throw new Error(`Invalid port: ${value}. Expected an integer from 1 to 65535`);
					}
					options.port = port;
					index++;
					break;
				}
				case "--workspace":
				case "--project":
					options.project = readValue(args, index, arg);
					index++;
					break;
				default:
					throw new Error(arg.startsWith("-") ? `Unknown web option: ${arg}` : `Unexpected web argument: ${arg}`);
			}
		}
		return options;
	}
	const prompt: string[] = [];
	let positionalOnly = false;

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (positionalOnly) {
			prompt.push(arg);
			continue;
		}
		if (arg === "--") {
			positionalOnly = true;
			continue;
		}
		switch (arg) {
			case "-h":
			case "--help":
				options.help = true;
				break;
			case "-v":
			case "--version":
				options.version = true;
				break;
			case "-p":
			case "--print":
				options.print = true;
				break;
			case "--list-agents":
				options.listAgents = true;
				break;
			case "--list-models":
				options.listModels = true;
				break;
			case "--list-sessions":
				options.listSessions = true;
				break;
			case "-c":
			case "--continue":
				options.continueSession = true;
				break;
			case "-a":
			case "--agent":
				options.agent = readValue(args, index, arg);
				index++;
				break;
			case "-m":
			case "--model": {
				const value = readValue(args, index, arg);
				const slash = value.indexOf("/");
				if (slash < 1 || slash === value.length - 1) throw new Error("--model must use provider/model format");
				options.model = { provider: value.slice(0, slash), id: value.slice(slash + 1) };
				index++;
				break;
			}
			case "--thinking": {
				const value = readValue(args, index, arg);
				if (!THINKING_LEVELS.has(value as ThinkingLevel)) {
					throw new Error(`Invalid thinking level: ${value}`);
				}
				options.thinking = value as ThinkingLevel;
				options.thinkingSpecified = true;
				index++;
				break;
			}
			case "--project":
				options.project = readValue(args, index, arg);
				index++;
				break;
			case "-s":
			case "--session":
				options.session = readValue(args, index, arg);
				index++;
				break;
			default:
				if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
				prompt.push(arg);
		}
	}

	if (options.session && options.continueSession) throw new Error("Use either --session or --continue, not both");
	options.prompt = prompt.join(" ").trim() || undefined;
	return options;
}
