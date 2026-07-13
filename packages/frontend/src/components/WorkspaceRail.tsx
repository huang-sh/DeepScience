import { For } from "solid-js"
import {
  leftCollapsed,
  setLeftCollapsed,
  rightCollapsed,
  setRightCollapsed,
  newChat,
  activeView,
  setActiveView,
  setSettingsOpen,
} from "../store"

const NAV_ITEMS: { id: "workspace-left" | "workspace-right" | "skills" | "resources" | "literature"; label: string; title: string; path: string }[] = [
  {
    id: "workspace-left",
    label: "Projects",
    title: "Show projects sidebar",
    path: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  },
  {
    id: "workspace-right",
    label: "Trace",
    title: "Show research trace",
    path: "M3 12h4l3-9 4 18 3-9h4",
  },
  {
    id: "skills",
    label: "Skills",
    title: "Skills and tools",
    path: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  },
  {
    id: "resources",
    label: "Resources",
    title: "Scientific resources",
    path: "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2zm0 0v6c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6",
  },
  // Temporarily hidden from the Rail. Keep the Literature view and routing
  // intact so this entry can be restored without rebuilding the feature.
  // {
  //   id: "literature",
  //   label: "Literature",
  //   title: "Literature search",
  //   path: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  // },
]

function NavIcon(props: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={props.path} />
    </svg>
  )
}

function isActive(id: typeof NAV_ITEMS[number]["id"]) {
  if (activeView() === "workspace") {
    if (id === "workspace-left") return !leftCollapsed()
    if (id === "workspace-right") return !rightCollapsed()
  }
  if (id === "skills") return activeView() === "skills"
  if (id === "resources") return activeView() === "resources"
  if (id === "literature") return activeView() === "literature"
  return false
}

export default function WorkspaceRail() {
  return (
    <aside class="rail" aria-label="DeepScience primary navigation">
      <div class="rail__top">
        <button
          class="rail__logo"
          onClick={() => { newChat(); setActiveView("workspace"); setLeftCollapsed(false); }}
          title="New session"
          aria-label="New DeepScience session"
        >
          <img class="rail__logo-mark" src="/deepscience-logo.png" alt="" aria-hidden="true" />
        </button>
      </div>

      <nav class="rail__nav" aria-label="Primary views">
        <For each={NAV_ITEMS}>
          {(item) => (
            <button
              class={`rail__nav-item ${isActive(item.id) ? "is-active" : ""}`}
              onClick={() => {
                if (item.id === "workspace-left") {
                  setActiveView("workspace")
                  setLeftCollapsed(false)
                } else if (item.id === "workspace-right") {
                  setActiveView("workspace")
                  setRightCollapsed(false)
                } else {
                  setActiveView(item.id)
                }
              }}
              title={item.title}
              aria-label={item.title}
              aria-current={isActive(item.id) ? "page" : undefined}
            >
              <NavIcon path={item.path} />
              <span class="rail__nav-label">{item.label}</span>
            </button>
          )}
        </For>
      </nav>

      <div class="rail__bottom">
        <button
          class="rail__nav-item"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Open settings"
        >
          <NavIcon path="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          <span class="rail__nav-label">Settings</span>
        </button>
      </div>
    </aside>
  )
}
