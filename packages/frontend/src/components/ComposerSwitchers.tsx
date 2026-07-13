import { For, Show, createSignal, createEffect, onCleanup } from "solid-js"
import {
  agents,
  selectedAgent,
  setSelectedAgent,
  models,
  selectedModel,
  setSelectedModel,
	selectedThinkingLevel,
	setSelectedThinkingLevel,
} from "../store"
import type { ThinkingLevel } from "../types"

const THINKING_LABEL: Record<ThinkingLevel, string> = {
	off: "Reasoning off",
	minimal: "Reasoning minimal",
	low: "Reasoning low",
	medium: "Reasoning medium",
	high: "Reasoning high",
	xhigh: "Reasoning xhigh",
	max: "Reasoning max",
}

function SwitcherChevron(props: { open: boolean }) {
  return (
    <svg
      class={`switcher__chevron ${props.open ? "is-open" : ""}`}
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

/**
 * Agent + model quick-switch chips. Shared by the chat composer (ChatPanel)
 * and the landing prompt (HomeLanding) so both input boxes expose switching
 * in the input box area.
 */
export default function ComposerSwitchers() {
  const currentAgent = () => agents().find((a) => a.name === selectedAgent())
  const thinkingLevels = (): ThinkingLevel[] => selectedModel()?.thinkingLevels ?? ["off"]

  const [openMenu, setOpenMenu] = createSignal<null | "agent" | "model" | "reasoning">(null)
  const [modelProvider, setModelProvider] = createSignal<string | null>(null)
  let switchersRef: HTMLDivElement | undefined

  const isActiveModel = (provider: string, id: string): boolean => {
    const cur = selectedModel()
    return !!cur && cur.provider === provider && cur.id === id
  }

  // Close the open menu on any click outside the switchers row.
  createEffect(() => {
    if (!openMenu()) return
    const handler = (e: MouseEvent) => {
      if (switchersRef && !switchersRef.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener("mousedown", handler)
    onCleanup(() => document.removeEventListener("mousedown", handler))
  })

  // Close open menu on Escape.
  createEffect(() => {
    if (!openMenu()) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (openMenu() === "model" && modelProvider()) {
        setModelProvider(null)
        return
      }
      setOpenMenu(null)
    }
    document.addEventListener("keydown", handler)
    onCleanup(() => document.removeEventListener("keydown", handler))
  })

  return (
    <div class="composer-switchers" ref={switchersRef}>
      {/* Agent */}
      <div class="switcher">
        <button
          class={`switcher__btn ${openMenu() === "agent" ? "is-open" : ""}`}
          onClick={() => setOpenMenu((v) => (v === "agent" ? null : "agent"))}
          aria-haspopup="menu"
          aria-expanded={openMenu() === "agent"}
          aria-label="Select agent"
        >
          <Show when={currentAgent()}>
            {(a) => <span class="switcher__dot" style={{ background: a().color }} aria-hidden="true" />}
          </Show>
          <span class="switcher__label">{selectedAgent()}</span>
          <SwitcherChevron open={openMenu() === "agent"} />
        </button>
        <Show when={openMenu() === "agent"}>
          <div class="switcher__menu" role="menu">
            <For each={agents()}>
              {(a) => (
                <button
                  class={`switcher__item ${a.name === selectedAgent() ? "is-active" : ""}`}
                  onClick={() => { setSelectedAgent(a.name); setOpenMenu(null) }}
                  role="menuitem"
                >
                  <span class="switcher__dot" style={{ background: a.color }} aria-hidden="true" />
                  <span class="switcher__item-main">
                    <span class="switcher__item-name">{a.name}</span>
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Model */}
      <div class="switcher">
        <button
          class={`switcher__btn ${openMenu() === "model" ? "is-open" : ""}`}
          onClick={() => {
            setOpenMenu((value) => {
              const next = value === "model" ? null : "model"
              if (next === "model") setModelProvider(null)
              return next
            })
          }}
          aria-haspopup="menu"
          aria-expanded={openMenu() === "model"}
          aria-label="Select model"
        >
          <span class="switcher__label switcher__label--mono">{selectedModel()?.name ?? "auto"}</span>
          <SwitcherChevron open={openMenu() === "model"} />
        </button>
        <Show when={openMenu() === "model"}>
          <div class="switcher__menu switcher__menu--wide" role="menu">
            <Show
              when={modelProvider()}
              fallback={
                <Show
                  when={Object.keys(models()).length > 0}
                  fallback={<div class="switcher__empty">No configured providers. Add an API key in Settings → Model.</div>}
                >
                  <For each={Object.entries(models())}>
                    {([provider, list]) => (
                      <button
                        class={`switcher__item ${selectedModel()?.provider === provider ? "is-active" : ""}`}
                        onClick={() => setModelProvider(provider)}
                        role="menuitem"
                        aria-label={`Show ${provider} models`}
                      >
                        <span class="switcher__item-main">
                          <span class="switcher__item-name">{provider}</span>
                          <span class="switcher__item-desc">{list.length} models</span>
                        </span>
                      </button>
                    )}
                  </For>
                </Show>
              }
            >
              {(provider) => (
                <div class="switcher__group">
                  <button class="switcher__item" onClick={() => setModelProvider(null)} role="menuitem">
                    <span class="switcher__item-main">
                      <span class="switcher__item-name">← Providers</span>
                      <span class="switcher__item-desc">{provider()}</span>
                    </span>
                  </button>
                  <div class="switcher__group-label">{provider()} models</div>
                  <For each={models()[provider()] ?? []}>
                    {(m) => (
                      <button
                        class={`switcher__item switcher__item--model ${isActiveModel(provider(), m.id) ? "is-active" : ""}`}
                        onClick={() => {
						  setSelectedModel({ ...m, provider: provider() })
                          setOpenMenu(null)
                          setModelProvider(null)
                        }}
                        role="menuitem"
                      >
                        <span class="switcher__item-name">{m.name}</span>
                      </button>
                    )}
                  </For>
                </div>
              )}
            </Show>
          </div>
        </Show>
      </div>

	  <Show when={(selectedModel()?.thinkingLevels?.length ?? 0) > 1}>
		<div class="switcher">
		  <button
			class={`switcher__btn ${openMenu() === "reasoning" ? "is-open" : ""}`}
			onClick={() => setOpenMenu((value) => value === "reasoning" ? null : "reasoning")}
			aria-haspopup="menu"
			aria-expanded={openMenu() === "reasoning"}
			aria-label="Select reasoning level"
		  >
			<span class="switcher__label">{THINKING_LABEL[selectedThinkingLevel()]}</span>
			<SwitcherChevron open={openMenu() === "reasoning"} />
		  </button>
		  <Show when={openMenu() === "reasoning"}>
			<div class="switcher__menu" role="menu">
			  <For each={thinkingLevels()}>
				{(level) => (
				  <button
					class={`switcher__item ${level === selectedThinkingLevel() ? "is-active" : ""}`}
					onClick={() => { setSelectedThinkingLevel(level); setOpenMenu(null) }}
					role="menuitem"
				  >
					<span class="switcher__item-name">{THINKING_LABEL[level]}</span>
				  </button>
				)}
			  </For>
			</div>
		  </Show>
		</div>
	  </Show>
	</div>
  )
}
