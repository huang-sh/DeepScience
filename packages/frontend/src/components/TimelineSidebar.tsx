import { For, Show } from "solid-js"
import {
  timeline,
  messages,
  rightCollapsed,
  setRightCollapsed,
  activeTraceView,
  setActiveTraceView,
  session,
  selectedAgent,
  activeWorkspaceFile,
  workspaceFileLoading,
} from "../store"
import { collectSessionArtifacts } from "../artifacts"
import ArtifactsSidebar from "./ArtifactsSidebar"

function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

export default function TimelineSidebar() {
  const toolCount = () => timeline().length
  const doneCount = () => timeline().filter((t) => t.status === "done").length
  const errorCount = () => timeline().filter((t) => t.status === "error").length
  const msgCount = () => messages().length
  const artifactCount = () =>
    collectSessionArtifacts(messages()).length + (activeWorkspaceFile() || workspaceFileLoading() ? 1 : 0)

  return (
    <aside class="ledger-panel" aria-label="Research trace">
      <div class="ledger-panel__mast">
        <div>
          <div class="ledger-panel__eyebrow">Trace</div>
          <div class="ledger-panel__title">Live trace</div>
        </div>
        <button
          class="archive-search__btn"
          onClick={() => setRightCollapsed(true)}
          aria-label="Collapse trace"
        >
          Collapse
        </button>
      </div>

      <div class="ledger-switcher" role="tablist" aria-label="Trace views">
        <button
          class={`ledger-switcher__tab ${activeTraceView() === "tools" ? "is-active" : ""}`}
          onClick={() => setActiveTraceView("tools")}
          role="tab"
          aria-selected={activeTraceView() === "tools"}
        >
          Tools
          <span class="ledger-switcher__count">{toolCount()}</span>
        </button>
        <button
          class={`ledger-switcher__tab ${activeTraceView() === "artifacts" ? "is-active" : ""}`}
          onClick={() => setActiveTraceView("artifacts")}
          role="tab"
          aria-selected={activeTraceView() === "artifacts"}
        >
          Artifacts
          <span class="ledger-switcher__count">{artifactCount()}</span>
        </button>
        <button
          class={`ledger-switcher__tab ${activeTraceView() === "summary" ? "is-active" : ""}`}
          onClick={() => setActiveTraceView("summary")}
          role="tab"
          aria-selected={activeTraceView() === "summary"}
        >
          Summary
        </button>
      </div>

      <div class="ledger-body">
        <Show when={activeTraceView() === "tools"}>
          <Show
            when={toolCount() > 0}
            fallback={
              <div class="ledger-empty">
                <div class="ledger-empty__title">No traces yet</div>
                <div class="ledger-empty__copy">
                  Tool calls will appear here as the agent works.
                </div>
              </div>
            }
          >
            <For each={timeline()}>
              {(entry) => (
                <div class={`trace-entry trace-entry--${entry.status}`}>
                  <div class="trace-entry__head">
                    <span class={`trace-entry__icon trace-entry__icon--${entry.status}`} aria-hidden="true" />
                    <span class="trace-entry__name">{entry.tool}</span>
                    <span class="trace-entry__time">{formatTime(entry.timestamp)}</span>
                  </div>
                  <Show when={entry.detail}>
                    <div class="trace-entry__detail">{entry.detail}</div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </Show>

        <Show when={activeTraceView() === "artifacts"}>
          <ArtifactsSidebar />
        </Show>

        <Show when={activeTraceView() === "summary"}>
          <div class="trace-summary">
            <div class="trace-stat">
              <div class="trace-stat__label">Messages</div>
              <div class="trace-stat__value">{msgCount()}</div>
            </div>
            <div class="trace-stat">
              <div class="trace-stat__label">Tools Called</div>
              <div class="trace-stat__value">{toolCount()}</div>
            </div>
            <div class="trace-stat">
              <div class="trace-stat__label">Completed</div>
              <div class="trace-stat__value">{doneCount()}</div>
            </div>
            <div class="trace-stat">
              <div class="trace-stat__label">Errors</div>
              <div class="trace-stat__value">{errorCount()}</div>
            </div>
          </div>

          <Show when={session()}>
            <div style={{ padding: "12px 16px" }}>
              <div class="ledger-chip">
                <div class="ledger-chip__label">Agent</div>
                <div class="ledger-chip__value">{selectedAgent()}</div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </aside>
  )
}
