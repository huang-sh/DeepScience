import { Index, Show, Switch, Match, createEffect, createSignal, onCleanup } from "solid-js"
import {
  messages,
  streaming,
  composerStatus,
  connState,
  selectedAgent,
  sendMessage,
  abortStream,
  openArtifact,
	openWorkspaceFile,
	forkSession,
	activeSessionId,
} from "../store"
import Markdown from "./Markdown"
import ResultRenderer from "./ResultRenderer"
import ComposerSwitchers from "./ComposerSwitchers"
import type { ChatMessage, MessagePart } from "../types"
import { toolStatusLabel } from "../presentation/tool-presenters"

export { toolStatusLabel } from "../presentation/tool-presenters"

export default function ChatPanel() {
  let canvasRef: HTMLDivElement | undefined
  let scrollFrame: number | undefined
  const [draft, setDraft] = createSignal("")
  const [autoScroll, setAutoScroll] = createSignal(true)

  createEffect(() => {
    const msgs = messages()
    if (msgs.length === 0 || !autoScroll()) return
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame)
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = undefined
      if (!canvasRef || !autoScroll()) return
      const bottom = Math.max(0, canvasRef.scrollHeight - canvasRef.clientHeight)
      if (Math.abs(canvasRef.scrollTop - bottom) > 1) canvasRef.scrollTop = bottom
    })
  })

  onCleanup(() => {
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame)
  })

  const onScroll = () => {
    if (!canvasRef) return
    const atBottom = canvasRef.scrollHeight - canvasRef.scrollTop - canvasRef.clientHeight < 80
    setAutoScroll(atBottom)
  }

  const canSend = () => draft().trim().length > 0 && !streaming() && connState() === "connected"
	const latestAssistantId = () => messages().findLast((message) => message.role === "assistant")?.id

  const submit = () => {
    if (!canSend()) return
    const value = draft()
    setDraft("")
    void sendMessage(value)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <main class="console-panel" role="log" aria-live="polite" aria-label="Research conversation">
      <div class="console-canvas" ref={canvasRef} onScroll={onScroll}>
        <div class="transcript-list">
          <Index each={messages()}>
            {(msg) => <TranscriptItem message={msg()} showFork={msg().id === latestAssistantId() && !msg().streaming} />}
          </Index>
        </div>
      </div>
      <div class="composer-dock">
        <div class="composer-dock__status" aria-live="polite">
          <span class={`composer-dock__conn composer-dock__conn--${connState()}`}>
            {connState()}
          </span>
          <Show when={composerStatus() && composerStatus() !== "Ready"}>
            <span class="composer-dock__sep" aria-hidden="true">·</span>
            <span>{composerStatus()}</span>
          </Show>
        </div>
        <div class="composer-dock__shell">
          <div class="composer-dock__editor">
            <textarea
              class="composer-dock__textarea"
              placeholder="Ask about proteins, genes, pathways, literature..."
              value={draft()}
              rows={1}
              disabled={connState() !== "connected"}
              onInput={(e) => {
                setDraft(e.currentTarget.value)
                e.currentTarget.style.height = "auto"
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`
              }}
              onKeyDown={onKeyDown}
              aria-label="Message input"
            />
            <Show
              when={!streaming()}
              fallback={
                <button
                  class="composer-dock__btn composer-dock__stop"
				  onClick={() => void abortStream()}
                  aria-label="Stop generation"
                >
                  Stop
                </button>
              }
            >
              <button
                class="composer-dock__btn composer-dock__send"
                disabled={!canSend()}
                onClick={submit}
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </Show>
          </div>

          {/* Agent + model quick-switchers (inside the input box) */}
          <ComposerSwitchers />
        </div>
      </div>
    </main>
  )
}

function TranscriptItem(props: { message: ChatMessage; showFork?: boolean }) {
  const msg = () => props.message

  const meta = () => {
    if (msg().role === "user") return "You"
    if (msg().role === "tool") return "Result"
    if (msg().role === "error") return "Error"
    if (msg().role === "tool") return "Tool"
    const agent = selectedAgent()
    return agent.charAt(0).toUpperCase() + agent.slice(1)
  }

  const hasText = () => msg().parts.some((p) => p.kind === "text" && p.text.trim())
	const groups = () => groupMessageParts(msg().parts)

  return (
    <article class={`transcript-item is-${msg().role}`}>
      <div class="transcript-item__meta">{meta()}</div>

      <Show when={hasText() || msg().role === "error"} fallback={
        <Show when={msg().parts.length > 0} fallback={<LiveRunPlaceholder />}>
          <div class="transcript-item__bubble">
            <Index each={groups()}>{(group) => <MessagePartGroupView group={group()} messageStreaming={msg().streaming === true} />}</Index>
          </div>
        </Show>
      }>
        <div class="transcript-item__bubble">
          <Index each={groups()}>{(group) => <MessagePartGroupView group={group()} messageStreaming={msg().streaming === true} />}</Index>
          <Show when={msg().streaming && msg().role === "assistant"}>
            <span class="stream-cursor" aria-hidden="true" />
          </Show>
        </div>
      </Show>
	  <Show when={props.showFork && msg().parts.some((part) => part.kind === "text" && part.phase === "final")}>
		<ResponseActions />
	  </Show>
    </article>
  )
}

function ResponseActions() {
	const [forking, setForking] = createSignal(false)
	const [error, setError] = createSignal("")

	const fork = async () => {
		const sessionId = activeSessionId()
		if (!sessionId || forking()) return
		setForking(true)
		setError("")
		try {
			await forkSession(sessionId)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		} finally {
			setForking(false)
		}
	}

	return (
		<div class="response-actions" aria-label="Response actions">
			<button class="response-actions__button" disabled={forking()} onClick={() => void fork()} title="Fork from this result">
				<Show when={!forking()} fallback={<span class="tool-card__spinner" />}>
					<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="13" r="1.5" /><circle cx="12" cy="5" r="1.5" />
						<path d="M4 4.5v7M5.5 11.5c0-4 6.5-2.5 6.5-5" />
					</svg>
				</Show>
				<span>{forking() ? "Forking…" : "Fork"}</span>
			</button>
			<Show when={error()}><span class="response-actions__error">Could not fork: {error()}</span></Show>
		</div>
	)
}

function LiveRunPlaceholder() {
	return (
		<div class="transcript-item__bubble">
			<section class="execution-steps is-expanded is-running" aria-label="Agent is starting">
				<div class="execution-steps__trigger execution-steps__trigger--static">
					<span class="tool-card__spinner" />
					<span class="execution-steps__label">Preparing research workflow…</span>
					<span class="execution-steps__live"><span />Live</span>
				</div>
				<div class="execution-steps__content">
					<div class="live-step"><span class="live-step__pulse" />Connecting to the agent and planning the next step</div>
				</div>
			</section>
		</div>
	)
}

type ToolPart = Extract<MessagePart, { kind: "tool" }>
type ThinkingPart = Extract<MessagePart, { kind: "thinking" }>
type ProcessTextPart = Extract<MessagePart, { kind: "text" }> & { phase: "pending" | "process" }
type ProcessPart = Exclude<MessagePart, { kind: "text" }> | (Extract<MessagePart, { kind: "text" }> & { phase: "pending" | "process" })
type MessagePartGroup =
	| { kind: "part"; key: string; part: MessagePart }
	| { kind: "steps"; key: string; parts: ProcessPart[] }

function isProcessPart(part: MessagePart): part is ProcessPart {
	return part.kind === "tool" || part.kind === "thinking" || (part.kind === "text" && (part.phase === "pending" || part.phase === "process"))
}

function asToolPart(part: ProcessPart): ToolPart | undefined {
	return part.kind === "tool" ? part : undefined
}

function asThinkingPart(part: ProcessPart): ThinkingPart | undefined {
	return part.kind === "thinking" ? part : undefined
}

function asProcessTextPart(part: ProcessPart): ProcessTextPart | undefined {
	return part.kind === "text" ? part : undefined
}

export function groupMessageParts(parts: MessagePart[]): MessagePartGroup[] {
	const groups: MessagePartGroup[] = []
	for (let index = 0; index < parts.length; index++) {
		const part = parts[index]
		if (!isProcessPart(part)) {
			groups.push({ kind: "part", key: `part-${index}`, part })
			continue
		}
		const previous = groups.at(-1)
		if (previous?.kind === "steps") {
			previous.parts.push(part)
			continue
		}
		groups.push({ kind: "steps", key: `steps-${part.id}`, parts: [part] })
	}
	return groups
}

function MessagePartGroupView(props: { group: MessagePartGroup; messageStreaming: boolean }) {
	return (
		<Switch>
			<Match when={props.group.kind === "steps" ? props.group : undefined}>
				{(group) => <ExecutionSteps parts={group().parts} messageStreaming={props.messageStreaming} />}
			</Match>
			<Match when={props.group.kind === "part" ? props.group : undefined}>
				{(group) => <PartView part={group().part} />}
			</Match>
		</Switch>
	)
}

function ExecutionSteps(props: { parts: ProcessPart[]; messageStreaming: boolean }) {
	const toolParts = () => props.parts.filter((part): part is ToolPart => part.kind === "tool")
	const runningTool = () => toolParts().findLast((part) => part.status === "running")
	const running = () => runningTool() !== undefined
	const active = () => props.messageStreaming || running() || props.parts.some((part) => (part.kind === "thinking" || part.kind === "text") && part.streaming)
	const failed = () => toolParts().filter((part) => part.status === "error").length
	const stopped = () => toolParts().filter((part) => part.status === "stopped").length
	const [expanded, setExpanded] = createSignal(active())

	createEffect(() => {
		if (active()) setExpanded(true)
	})

	const summary = () => {
		if (running()) return `Running ${runningTool()?.tool ?? "step"}…`
		if (active() && props.parts.at(-1)?.kind === "thinking") return "Thinking…"
		if (active()) return "Working…"
		if (failed()) return `${props.parts.length} step${props.parts.length === 1 ? "" : "s"} · ${failed()} failed`
		if (stopped()) return `${props.parts.length} step${props.parts.length === 1 ? "" : "s"} · stopped`
		if (props.parts.some((part) => part.kind === "thinking")) return "Reasoning and execution steps"
		return `${props.parts.length} step${props.parts.length === 1 ? "" : "s"} completed`
	}

	return (
		<section class={`execution-steps ${expanded() ? "is-expanded" : ""} ${active() ? "is-running" : ""}`}>
			<button
				class="execution-steps__trigger"
				onClick={() => setExpanded((value) => !value)}
				aria-expanded={expanded()}
			>
				<Show when={!active()} fallback={<span class="tool-card__spinner" />}>
					<svg class="execution-steps__chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
						<path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</Show>
				<span class="execution-steps__label">{summary()}</span>
				<Show when={active()}><span class="execution-steps__live"><span />Live</span></Show>
				<span class="execution-steps__action">{expanded() ? "Hide steps" : "Show steps"}</span>
			</button>
			<Show when={expanded()}>
				<div class="execution-steps__content">
					<Index each={props.parts}>
						{(part) => (
							<Switch>
								<Match when={asToolPart(part())}>{(tool) => <ToolCard part={tool()} />}</Match>
								<Match when={asThinkingPart(part())}>{(thinking) => <ThinkingBlock part={thinking()} live={active()} />}</Match>
								<Match when={asProcessTextPart(part())}>
									{(text) => <div class="execution-steps__commentary"><Markdown text={text().text} sessionId={activeSessionId() ?? undefined} onOpenFile={(path) => void openWorkspaceFile(path)} /></div>}
								</Match>
							</Switch>
						)}
					</Index>
					<Show when={active() && !running()}>
						<div class="live-step"><span class="live-step__pulse" />Preparing the next step…</div>
					</Show>
				</div>
			</Show>
		</section>
	)
}

function ThinkingBlock(props: { part: Extract<MessagePart, { kind: "thinking" }>; live?: boolean }) {
	let contentRef: HTMLDivElement | undefined
	let scrollFrame: number | undefined
	const [expanded, setExpanded] = createSignal(props.part.streaming === true || props.live === true)
	const visible = () => expanded() || props.part.streaming === true

	createEffect(() => {
		props.part.text
		if (!props.part.streaming) return
		if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame)
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = undefined
			if (contentRef) contentRef.scrollTop = contentRef.scrollHeight
		})
	})

	onCleanup(() => {
		if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame)
	})

	return (
		<div class={`thinking-block ${visible() ? "is-expanded" : ""} ${props.part.streaming ? "is-streaming" : ""}`}>
			<button class="thinking-block__trigger" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded()}>
				<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
				<span>{props.part.redacted ? "Reasoning redacted" : "Reasoning"}</span>
			</button>
			<Show when={visible()}>
				<div class="thinking-block__content" ref={contentRef}>
					{props.part.redacted ? "Provider-redacted reasoning content." : props.part.text}
					<Show when={props.part.streaming}><span class="stream-cursor" aria-hidden="true" /></Show>
				</div>
			</Show>
		</div>
	)
}

function PartView(props: { part: MessagePart }) {
  return (
    <Switch fallback={null}>
      <Match when={props.part.kind === "tool" ? props.part : undefined}>
        {(toolPart) => <ToolCard part={toolPart()} />}
      </Match>
      <Match when={props.part.kind === "text" ? props.part : undefined}>
		{(textPart) => (
		  <Show when={textPart().text.trim()}>
			<Show
			  when={textPart().phase === "final"}
			fallback={<Markdown text={textPart().text} sessionId={activeSessionId() ?? undefined} onOpenFile={(path) => void openWorkspaceFile(path)} />}
			>
			  <section class="final-response">
				<div class="final-response__label">Response</div>
				<Markdown text={textPart().text} sessionId={activeSessionId() ?? undefined} onOpenFile={(path) => void openWorkspaceFile(path)} />
			  </section>
			</Show>
		  </Show>
		)}
      </Match>
	  <Match when={props.part.kind === "thinking" ? props.part : undefined}>
		{(thinking) => <ThinkingBlock part={thinking()} />}
	  </Match>
    </Switch>
  )
}

function ToolCard(props: { part: Extract<MessagePart, { kind: "tool" }> }) {
  const [expanded, setExpanded] = createSignal(props.part.status === "running")
  const part = () => props.part

	createEffect(() => {
		if (part().status === "running") setExpanded(true)
	})

  const badgeClass = () => {
    switch (part().status) {
      case "running": return "tool-card__badge--running"
      case "done": return "tool-card__badge--done"
      case "error": return "tool-card__badge--error"
	  case "stopped": return "tool-card__badge--stopped"
    }
  }

  const badgeLabel = () => {
	return toolStatusLabel(part())
  }

  const argsString = () => {
    const args = part().args
    if (!args || Object.keys(args).length === 0) return ""
    return JSON.stringify(args, null, 2)
  }

  const hasResult = () => {
    const content = part().content
    return !!(content && content.length > 0) || !!(part().output ?? "").trim()
  }

  return (
    <div class={`tool-card ${expanded() ? "tool-card--expanded" : ""}`}>
      <div class="tool-card__header">
        <button
          class="tool-card__toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded()}
          aria-label={`${part().tool} tool call, status ${part().status}`}
        >
          <Show when={part().status !== "running"} fallback={<span class="tool-card__spinner" />}>
            <svg class="tool-card__chevron" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="var(--ds-soft)" stroke-width="1.5" aria-hidden="true">
              <path d="M4 2L8 6L4 10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </Show>
          <span class="tool-card__name">{part().tool}</span>
		  <span class={`tool-card__badge ${badgeClass()}`}>{badgeLabel()}</span>
        </button>
        <Show when={hasResult()}>
          <button
            class="tool-card__expand"
            title="Open in panel"
            aria-label="Open tool output in panel"
            onClick={(e) => {
              e.stopPropagation()
              openArtifact(part().tool, part().tool, part().content ?? part().output ?? "", part().output, part().id)
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 3H12.5C12.78 3 13 3.22 13 3.5V10" />
              <path d="M13 3L7 9" />
              <path d="M10 13H4.5C4.22 13 4 12.78 4 12.5V7" />
              </svg>
          </button>
        </Show>
      </div>

	  <Show when={expanded()}>
		<div class="tool-card__details">
		  <Show when={argsString()}>
			<div class="tool-card__body">
			  <div class="tool-card__label">Arguments</div>
			  <pre class="tool-card__args">{argsString()}</pre>
			</div>
		  </Show>
		  <Show when={hasResult()}>
			<div class="tool-card__result">
			  <div class="tool-card__label">Result</div>
			  <ResultRenderer
				content={part().content}
				output={part().output}
				status={part().status}
				preview={true}
				sessionId={activeSessionId() ?? undefined}
				onOpenFile={(path) => void openWorkspaceFile(path)}
				onOpen={() => openArtifact(part().tool, part().tool, part().content ?? part().output ?? "", part().output, part().id)}
				ariaLabel={`${part().tool} result preview`}
			  />
			</div>
		  </Show>
		  <Show when={part().status === "running" && !hasResult()}>
			<div class="tool-card__waiting"><span class="live-step__pulse" />Waiting for live output…</div>
		  </Show>
		</div>
	  </Show>
    </div>
  )
}
