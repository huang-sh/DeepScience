import { onMount, Show, createEffect } from "solid-js"
import {
  init,
  leftCollapsed,
  setLeftCollapsed,
  rightCollapsed,
  setRightCollapsed,
  leftWidth,
  setLeftWidth,
  rightWidth,
  setRightWidth,
  messages,
  activeView,
  settingsOpen,
  setSettingsOpen,
} from "./store"
import WorkspaceRail from "./components/WorkspaceRail"
import SessionSidebar from "./components/SessionSidebar"
import ChatPanel from "./components/ChatPanel"
import HomeLanding from "./components/HomeLanding"
import TimelineSidebar from "./components/TimelineSidebar"
import Resizer from "./components/Resizer"
import SettingsModal from "./components/SettingsModal"
import SkillsView from "./components/SkillsView"
import ResourcesView from "./components/ResourcesView"
import LiteratureView from "./components/LiteratureView"

const LEFT_PANEL_WIDTH_KEY = "deepscience.ui.left-panel-width"
const RIGHT_PANEL_WIDTH_KEY = "deepscience.ui.right-panel-width"
const LEFT_PANEL_MIN_WIDTH = 220
const LEFT_PANEL_MAX_WIDTH = 640
const RIGHT_PANEL_MIN_WIDTH = 240
const RIGHT_PANEL_MAX_WIDTH = 800

function storedPanelWidth(key: string, fallback: number, min: number, max: number): number {
  if (typeof localStorage === "undefined") return fallback
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback
}

export default function App() {
  onMount(() => {
    setLeftWidth(storedPanelWidth(LEFT_PANEL_WIDTH_KEY, 280, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH))
    setRightWidth(storedPanelWidth(RIGHT_PANEL_WIDTH_KEY, 300, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH))
    void init()
  })

  createEffect(() => {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(leftWidth()))
    localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(rightWidth()))
  })

  // Close overlays when the active view changes away from workspace.
  createEffect(() => {
    if (activeView() !== "workspace") {
      setLeftCollapsed(true)
      setRightCollapsed(true)
    }
  })

  const shellClass = () => {
    const cls: string[] = []
    if (leftCollapsed()) cls.push("is-left-collapsed")
    if (rightCollapsed()) cls.push("is-right-collapsed")
    return cls.join(" ")
  }

  return (
    <div class="workspace-root">
      <WorkspaceRail />

      <div class="workspace-stage">
        <Show when={activeView() === "workspace"} fallback={
          <Show when={activeView() === "skills"} fallback={
            <Show when={activeView() === "resources"} fallback={<LiteratureView />}>
              <ResourcesView />
            </Show>
          }>
            <SkillsView />
          </Show>
        }>
          <div
            class={`workspace-shell ${shellClass()}`}
            style={`--left-panel-width: ${leftCollapsed() ? 0 : leftWidth()}px; --right-panel-width: ${rightCollapsed() ? 0 : rightWidth()}px;`}
          >
            {/* Left panel */}
            <SessionSidebar />

            {/* Left resizer */}
            <Show when={!leftCollapsed()}>
              <Resizer
                width={leftWidth()}
                onResize={(delta) =>
                  setLeftWidth((width) =>
                    Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(LEFT_PANEL_MAX_WIDTH, width + delta)),
                  )
                }
                onReset={() => setLeftWidth(280)}
              />
            </Show>

            {/* Center */}
            <div class="workspace-center">
              <Show when={leftCollapsed()}>
                <button
                  class="edge-toggle edge-toggle--left"
                  onClick={() => { setLeftWidth(280); setLeftCollapsed(false); }}
                  title="Show sidebar"
                  aria-label="Show project sidebar"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              </Show>

              <Show when={messages().length > 0} fallback={<HomeLanding />}>
                <ChatPanel />
              </Show>

              <Show when={rightCollapsed() && messages().length > 0}>
                <button
                  class="edge-toggle edge-toggle--right"
                  onClick={() => setRightCollapsed(false)}
                  title="Show trace"
                  aria-label="Show research trace"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                </button>
              </Show>
            </div>

            {/* Right resizer */}
            <Show when={!rightCollapsed()}>
              <Resizer
                width={rightWidth()}
                onResize={(delta) =>
                  setRightWidth((width) =>
                    Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, width + delta)),
                  )
                }
                onReset={() => setRightWidth(300)}
                side="right"
              />
            </Show>

            {/* Right panel */}
            <TimelineSidebar />
          </div>
        </Show>
      </div>

      {/* Settings modal overlay */}
      <Show when={settingsOpen()}>
        <SettingsModal />
      </Show>
    </div>
  )
}
