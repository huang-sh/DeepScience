import { CombinedAutocompleteProvider, Editor, Markdown, ProcessTerminal, Text, TUI } from "@earendil-works/pi-tui";
import { colors, editorTheme, markdownTheme } from "./cli-theme.ts";
import { abortSessionAndWait, runSessionPrompt, type SSEEvent } from "./session.ts";
import type { SessionInfo } from "./session-store.ts";

export interface TuiOptions {
	session: SessionInfo;
	initialPrompt?: string;
}

function compactValue(value: unknown, maxLength = 240): string {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	if (!text) return "";
	return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

export async function runTui(options: TuiOptions): Promise<void> {
	const tui = new TUI(new ProcessTerminal());
	const transcript = tui.children;
	const header = new Text(
		`${colors.bold(colors.cyan("DeepScience"))}  ${options.session.agentName} · ${options.session.model.provider}/${options.session.model.id}\n` +
			`${colors.dim(`session ${options.session.id} · thinking ${options.session.thinkingLevel ?? "medium"}`)}\n` +
			`${colors.dim(`workspace ${options.session.directory ?? options.session.projectDirectory ?? process.cwd()}`)}`,
		1,
		1,
	);
	const status = new Text(colors.dim("Ready · /help for commands"), 1, 0);
	const editor = new Editor(tui, editorTheme, { paddingX: 1 });
	editor.setAutocompleteProvider(
		new CombinedAutocompleteProvider(
			[
				{ name: "help", description: "Show TUI commands" },
				{ name: "status", description: "Show session and workspace" },
				{ name: "clear", description: "Clear visible transcript" },
				{ name: "stop", description: "Stop the active task" },
				{ name: "exit", description: "Exit DeepScience" },
			],
			options.session.directory ?? process.cwd(),
		),
	);
	tui.addChild(header);
	tui.addChild(status);
	tui.addChild(editor);
	tui.setFocus(editor);

	let running = false;
	let closed = false;
	let finish: (() => void) | undefined;
	const completion = new Promise<void>((resolve) => {
		finish = resolve;
	});

	const insert = (component: Text | Markdown) => {
		transcript.splice(transcript.length - 1, 0, component);
		tui.requestRender();
	};

	const close = async () => {
		if (closed) return;
		closed = true;
		if (running) await abortSessionAndWait(options.session.id);
		tui.stop();
		finish?.();
	};

	const run = async (message: string) => {
		running = true;
		insert(new Text(`${colors.bold("You")}\n${message}`, 1, 1));
		const live = new Markdown("", 1, 0, markdownTheme);
		insert(live);
		let streamedText = "";
		const tools = new Map<string, Text>();
		status.setText(colors.cyan("Thinking…"));
		tui.requestRender();

		const onEvent = (event: SSEEvent) => {
			if (event.type === "text_delta" && typeof event.delta === "string") {
				streamedText += event.delta;
				live.setText(streamedText);
			} else if (event.type === "thinking_delta") {
				status.setText(colors.cyan("Reasoning…"));
			} else if (event.type === "tool_start") {
				const callId = String(event.callId ?? "");
				const tool = String(event.tool ?? "tool");
				const step = new Text(`${colors.yellow("RUN")} ${tool}  ${colors.dim(compactValue(event.args))}`, 2, 0);
				tools.set(callId, step);
				insert(step);
				status.setText(colors.cyan(`Running ${tool}…`));
			} else if (event.type === "tool_end") {
				const callId = String(event.callId ?? "");
				const tool = String(event.tool ?? "tool");
				const failed = event.isError === true;
				const marker = failed ? colors.red("ERROR") : colors.green("DONE");
				const output = compactValue(event.output);
				const line = `${marker} ${tool}${output ? `\n${colors.dim(output)}` : ""}`;
				const step = tools.get(callId);
				if (step) step.setText(line);
				else insert(new Text(line, 2, 0));
			}
			tui.requestRender();
		};

		try {
			const result = await runSessionPrompt(options.session.id, message, { onEvent });
			if (result.processText && result.finalText) {
				live.setText(`${colors.dim("Process")}\n${result.processText}`);
				insert(new Markdown(result.finalText, 1, 1, markdownTheme));
			} else {
				live.setText(result.finalText || result.processText || streamedText || "(No text result)");
			}
			if (result.stopReason === "error" || result.errorMessage) {
				status.setText(colors.red(`Failed · ${result.errorMessage ?? result.stopReason}`));
			} else if (result.stopReason === "aborted") {
				status.setText(colors.yellow("Stopped"));
			} else {
				status.setText(colors.dim("Ready"));
			}
		} catch (error) {
			live.setText(colors.red(error instanceof Error ? error.message : String(error)));
			status.setText(colors.red("Task failed"));
		} finally {
			running = false;
			tui.requestRender();
		}
	};

	editor.onSubmit = (value) => {
		const message = value.trim();
		if (!message) return;
		if (message === "/exit" || message === "/quit") {
			void close();
			return;
		}
		if (message === "/stop") {
			if (running) void abortSessionAndWait(options.session.id);
			else status.setText(colors.dim("No task is running"));
			tui.requestRender();
			return;
		}
		if (message === "/help") {
			insert(
				new Text(
					"/status  session details\n/clear   clear visible transcript\n/stop    stop active task\n/exit    exit",
					1,
					1,
				),
			);
			return;
		}
		if (message === "/status") {
			insert(
				new Text(
					`Session: ${options.session.id}\nAgent: ${options.session.agentName}\nModel: ${options.session.model.provider}/${options.session.model.id}\nThinking: ${options.session.thinkingLevel ?? "medium"}\nWorkspace: ${options.session.directory ?? "-"}`,
					1,
					1,
				),
			);
			return;
		}
		if (message === "/clear") {
			transcript.splice(2, Math.max(0, transcript.length - 3));
			tui.requestRender(true);
			return;
		}
		if (running) {
			status.setText(colors.yellow("A task is already running; use /stop first"));
			tui.requestRender();
			return;
		}
		void run(message);
	};

	const onSignal = () => void close();
	process.once("SIGINT", onSignal);
	process.once("SIGTERM", onSignal);
	tui.start();
	const initialPrompt = options.initialPrompt;
	if (initialPrompt) queueMicrotask(() => void run(initialPrompt));
	await completion;
	process.off("SIGINT", onSignal);
	process.off("SIGTERM", onSignal);
}
