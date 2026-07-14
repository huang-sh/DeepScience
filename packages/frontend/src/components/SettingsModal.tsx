import { Show, For, Switch, Match, createSignal, createMemo, createEffect, onCleanup, onMount } from "solid-js"
import * as api from "../api"
import {
  settingsOpen,
  setSettingsOpen,
  agents,
  selectedAgent,
  setSelectedAgent,
  models,
  selectedModel,
  setSelectedModel,
  connState,
  theme,
  setTheme,
  THEMES,
  capabilities,
  featureEnabled,
  settingsPanelVisible,
  refreshModels,
  workspaceSelection,
} from "../store"
import type { ConnectionState, ConnectorCatalog, ConnectorDefinition, ConnectorTestResult, ProviderCredentialStatus, ProviderOAuthJob } from "../types"

const CONN_META: Record<ConnectionState, { color: string; label: string; desc: string }> = {
  connecting: { color: "var(--ds-amber)", label: "Connecting", desc: "Establishing a link to the DeepScience server…" },
  connected: { color: "var(--ds-emerald)", label: "Connected", desc: "Live link to the DeepScience server — tools and models are available." },
  disconnected: { color: "var(--ds-danger)", label: "Disconnected", desc: "No link to the server. Restart the dev server or check the backend." },
}

/* ── Icons (16px, stroke = currentColor) ─────────────────────────────── */

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function Chevron(props: { dir: "left" | "right" }) {
  const d = props.dir === "left" ? "M10 3 L5 8 L10 13" : "M6 3 L11 8 L6 13"
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function RailIcon(props: { name: string }) {
  const common = { viewBox: "0 0 16 16", width: "15", height: "15", fill: "none", stroke: "currentColor", "stroke-width": "1.5" as const, "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const }
  switch (props.name) {
    case "agent":
      return (<svg {...common}><circle cx="8" cy="5.5" r="2.6" /><path d="M3 13.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" /></svg>)
    case "model":
      return (<svg {...common}><rect x="4.5" y="4.5" width="7" height="7" rx="1.6" /><rect x="6.6" y="6.6" width="2.8" height="2.8" rx="0.5" /><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" /></svg>)
    case "appearance":
      return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" /></svg>)
    case "connection":
      return (<svg {...common}><path d="M2 6.2c3.6-3.4 8.4-3.4 12 0" /><path d="M4.4 8.7c2.4-2.2 4.8-2.2 7.2 0" /><path d="M6.7 11.1c1-0.9 1.6-0.9 2.6 0" /><circle cx="8" cy="13.4" r="0.9" fill="currentColor" stroke="none" /></svg>)
    case "connectors":
      return (<svg {...common}><path d="M6.2 5.1 4.7 3.6a2.1 2.1 0 0 0-3 3l2.1 2.1a2.1 2.1 0 0 0 3 0l.8-.8" /><path d="m9.8 10.9 1.5 1.5a2.1 2.1 0 0 0 3-3l-2.1-2.1a2.1 2.1 0 0 0-3 0l-.8.8" /><path d="m5.7 10.3 4.6-4.6" /></svg>)
    case "about":
      return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.3" /><circle cx="8" cy="5" r="0.85" fill="currentColor" stroke="none" /></svg>)
    default:
      return null
  }
}

/* ── Shared selectors ────────────────────────────────────────────────── */

function isActiveModel(provider: string, id: string): boolean {
  const cur = selectedModel()
  return !!cur && cur.provider === provider && cur.id === id
}

const modelCount = () => Object.values(models()).reduce((n, list) => n + list.length, 0)

/* ── Panels ──────────────────────────────────────────────────────────── */

function AgentPanel() {
  return (
    <div class="settings-panel">
      <p class="settings-panel__hint">Pick the specialist that handles your requests. Each agent has its own tools and system prompt.</p>
      <Show when={agents().find((a) => a.name === selectedAgent())} keyed>
        {(a) => (
          <div class="modal-current">
            <span class="modal-current__name" style={{ color: a.color }}>{a.name}</span>
            <span class="modal-current__desc">{a.description}</span>
          </div>
        )}
      </Show>
      <div class="modal-agent-grid">
        <For each={agents()}>
          {(agent) => (
            <button
              class={`modal-agent-card ${agent.name === selectedAgent() ? "is-active" : ""}`}
              onClick={() => setSelectedAgent(agent.name)}
            >
              <span class="modal-agent-card__name" style={{ color: agent.color }}>{agent.name}</span>
              <span class="modal-agent-card__desc">{agent.description}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

function ModelPanel() {
  const [providers, setProviders] = createSignal<ProviderCredentialStatus[]>([])
  const [provider, setProvider] = createSignal<string | null>(null)
  const [apiKey, setApiKey] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [oauthBusy, setOAuthBusy] = createSignal(false)
  const [oauthJob, setOAuthJob] = createSignal<ProviderOAuthJob | null>(null)
  const [oauthInput, setOAuthInput] = createSignal("")
  const [error, setError] = createSignal("")
  const [notice, setNotice] = createSignal("")
  let oauthPoll: ReturnType<typeof setInterval> | undefined

  const selectedProvider = () => providers().find((item) => item.id === provider())
  const oauthAuthUrlEvent = () => {
    const event = oauthJob()?.event
    return event?.type === "auth_url" ? event : undefined
  }
  const oauthDeviceCodeEvent = () => {
    const event = oauthJob()?.event
    return event?.type === "device_code" ? event : undefined
  }
  const oauthProgressEvent = () => {
    const event = oauthJob()?.event
    return event?.type === "progress" ? event : undefined
  }
  const providerModels = () => {
    const selected = provider()
    return selected ? models()[selected] ?? [] : []
  }
  const sortedProviders = createMemo(() =>
    [...providers()].sort((left, right) =>
      Number(right.configured) - Number(left.configured) || left.name.localeCompare(right.name),
    ),
  )

  const loadProviders = async () => {
    setLoading(true)
    setError("")
    try {
      setProviders((await api.fetchProviders()).providers)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  const stopOAuthPolling = () => {
    if (oauthPoll !== undefined) clearInterval(oauthPoll)
    oauthPoll = undefined
  }

  const acceptOAuthJob = async (job: ProviderOAuthJob) => {
    setOAuthJob((current) => current?.id === job.id && current.updatedAt === job.updatedAt ? current : job)
    if (job.phase === "complete") {
      stopOAuthPolling()
      await loadProviders()
      await refreshModels()
      setNotice(`${job.authName} login completed.`)
    } else if (job.phase === "error" || job.phase === "cancelled") {
      stopOAuthPolling()
      if (job.phase === "error") setError(job.error ?? "OAuth login failed.")
    }
  }

  const pollOAuth = () => {
    stopOAuthPolling()
    oauthPoll = setInterval(() => {
      const job = oauthJob()
      if (!job || job.phase === "complete" || job.phase === "error" || job.phase === "cancelled") {
        stopOAuthPolling()
        return
      }
      void api.fetchProviderOAuth(job.id)
        .then((next) => acceptOAuthJob(next))
        .catch((cause) => {
          stopOAuthPolling()
          setError(cause instanceof Error ? cause.message : String(cause))
        })
    }, 1000)
  }

  const startOAuth = async () => {
    const selected = selectedProvider()
    if (!selected?.oauthSupported) return
    setOAuthBusy(true)
    setError("")
    setNotice("")
    setOAuthInput("")
    try {
      await acceptOAuthJob(await api.startProviderOAuth(selected.id))
      pollOAuth()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setOAuthBusy(false)
    }
  }

  const answerOAuthPrompt = async (value = oauthInput()) => {
    const job = oauthJob()
    if (!job?.prompt) return
    setOAuthBusy(true)
    setError("")
    try {
      setOAuthInput("")
      await acceptOAuthJob(await api.respondProviderOAuth(job.id, job.prompt.id, value))
      pollOAuth()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setOAuthBusy(false)
    }
  }

  const cancelOAuth = async () => {
    const job = oauthJob()
    if (!job) return
    setOAuthBusy(true)
    try {
      await acceptOAuthJob(await api.cancelProviderOAuth(job.id))
      setNotice("Login cancelled.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setOAuthBusy(false)
    }
  }

  const logoutOAuth = async () => {
    const selected = selectedProvider()
    if (!selected?.oauthStored) return
    setOAuthBusy(true)
    setError("")
    setNotice("")
    try {
      const payload = await api.logoutProviderOAuth(selected.id)
      setProviders(payload.providers)
      setOAuthJob(null)
      await refreshModels()
      setNotice(`${selected.oauthName ?? selected.name} logged out.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setOAuthBusy(false)
    }
  }

  const saveKey = async () => {
    const selected = selectedProvider()
    if (!selected || !apiKey().trim()) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const payload = await api.saveProviderApiKey(selected.id, apiKey())
      setProviders(payload.providers)
      setApiKey("")
      await refreshModels()
      setNotice(`${selected.name} API key saved.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  const removeKey = async () => {
    const selected = selectedProvider()
    if (!selected?.stored) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const payload = await api.deleteProviderApiKey(selected.id)
      setProviders(payload.providers)
      setApiKey("")
      await refreshModels()
      setNotice(`${selected.name} stored API key removed.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  onMount(() => void loadProviders())
  onCleanup(stopOAuthPolling)

  const chooseProvider = (id: string | null) => {
    stopOAuthPolling()
    setProvider(id)
    setApiKey("")
    setOAuthInput("")
    setOAuthJob(null)
    setError("")
    setNotice("")
  }

  return (
    <div class="settings-panel">
      <p class="settings-panel__hint">
        {provider()
          ? "Configure this provider, then choose one of its available models. API keys are stored by the DeepScience server and are never returned to the browser."
          : "Configure model providers here. Only providers with working authentication are shown in the composer model selector."}
      </p>
      <Show when={selectedModel()} keyed>
        {(m) => (
          <div class="modal-current">
            <span class="modal-current__name">{m.name}</span>
            <span class="modal-current__desc">{m.provider} · {m.id}</span>
          </div>
        )}
      </Show>

      <Show
        when={provider()}
        fallback={
          <Show when={!loading()} fallback={<div class="settings-empty">Loading model providers…</div>}>
            <div class="modal-agent-grid">
              <For each={sortedProviders()}>
                {(item) => (
                  <button
                    class={`modal-agent-card ${selectedModel()?.provider === item.id ? "is-active" : ""}`}
                    onClick={() => chooseProvider(item.id)}
                  >
                    <span class="provider-card__top">
                      <span class="modal-agent-card__name">{item.name}</span>
                      <span class={`provider-status ${item.configured ? "is-configured" : ""}`}>
                        {item.configured ? "Configured" : "Not configured"}
                      </span>
                    </span>
                    <span class="modal-agent-card__desc">
                      {item.configured
                        ? `${item.modelCount} models · ${item.source ?? "authenticated"}`
                        : item.oauthName ?? item.envVariable ?? "External setup required"}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        }
      >
        {(providerName) => (
          <div class="modal-model-group">
            <button class="modal-model-item" onClick={() => chooseProvider(null)}>
              ← All providers
            </button>
            <Show when={selectedProvider()} keyed>
              {(item) => (
                <>
                  <div class="provider-detail">
                    <div class="provider-detail__header">
                      <div>
                        <div class="provider-detail__name">{item.name}</div>
                        <div class="provider-detail__id">{item.id}</div>
                      </div>
                      <span class={`provider-status ${item.configured ? "is-configured" : ""}`}>
                        {item.configured ? "Configured" : "Not configured"}
                      </span>
                    </div>
                    <Show when={item.oauthSupported}>
                      <label class="provider-key-label">Subscription login · {item.oauthName}</label>
                      <div class="provider-key-row">
                        <button class="provider-key-save" onClick={() => void startOAuth()} disabled={oauthBusy()}>
                          {oauthBusy() ? "Working…" : item.oauthStored ? "Log in again" : "Log in"}
                        </button>
                        <Show when={item.oauthStored}>
                          <button class="provider-key-remove" onClick={() => void logoutOAuth()} disabled={oauthBusy()}>
                            Log out
                          </button>
                        </Show>
                      </div>
                      <Show when={oauthJob()}>
                        <div class="modal-current">
                          <span class="modal-current__name">
                            {oauthJob()?.phase === "complete" ? "Login complete" : oauthJob()?.phase === "error" ? "Login failed" : oauthJob()?.phase === "cancelled" ? "Login cancelled" : "Login in progress"}
                          </span>
                          <Show when={oauthAuthUrlEvent()}>
                            {(event) => (
                              <>
                                <span class="modal-current__desc">{event().instructions ?? "Complete authorization in your browser."}</span>
                                <a class="provider-key-save" href={event().url} target="_blank" rel="noopener noreferrer">Open authorization page</a>
                              </>
                            )}
                          </Show>
                          <Show when={oauthDeviceCodeEvent()}>
                            {(event) => (
                              <>
                                <span class="modal-current__desc">Enter this device code on the authorization page:</span>
                                <input class="provider-key-input" value={event().userCode} readOnly />
                                <a class="provider-key-save" href={event().verificationUri} target="_blank" rel="noopener noreferrer">Open authorization page</a>
                              </>
                            )}
                          </Show>
                          <Show when={oauthProgressEvent()}>
                            {(event) => <span class="modal-current__desc">{event().message}</span>}
                          </Show>
                          <Show when={oauthJob()?.prompt}>
                            {(prompt) => (
                              <>
                                <span class="modal-current__desc">{prompt().message}</span>
                                <Show
                                  when={prompt().type === "select"}
                                  fallback={
                                    <div class="provider-key-row">
                                      <input
                                        class="provider-key-input"
                                        type={prompt().type === "secret" ? "password" : "text"}
                                        value={oauthInput()}
                                        placeholder={prompt().placeholder}
                                        onInput={(event) => setOAuthInput(event.currentTarget.value)}
                                        onKeyDown={(event) => { if (event.key === "Enter") void answerOAuthPrompt() }}
                                        autocomplete="off"
                                        spellcheck={false}
                                      />
                                      <button class="provider-key-save" onClick={() => void answerOAuthPrompt()} disabled={oauthBusy()}>Continue</button>
                                    </div>
                                  }
                                >
                                  <div class="provider-key-row">
                                    <For each={prompt().options ?? []}>
                                      {(option) => (
                                        <button class="provider-key-save" onClick={() => void answerOAuthPrompt(option.id)} disabled={oauthBusy()}>
                                          {option.label}
                                        </button>
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </>
                            )}
                          </Show>
                          <Show when={oauthJob()?.phase === "pending" || oauthJob()?.phase === "waiting"}>
                            <button class="provider-key-remove" onClick={() => void cancelOAuth()} disabled={oauthBusy()}>Cancel login</button>
                          </Show>
                        </div>
                      </Show>
                    </Show>
                    <Show when={item.manageable}>
                      <label class="provider-key-label" for={`provider-key-${item.id}`}>API key</label>
                      <div class="provider-key-row">
                        <input
                          id={`provider-key-${item.id}`}
                          class="provider-key-input"
                          type="password"
                          value={apiKey()}
                          onInput={(event) => setApiKey(event.currentTarget.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") void saveKey() }}
                          placeholder={item.stored ? "Enter a new key to replace the stored key" : `Enter ${item.envVariable ?? "API key"}`}
                          autocomplete="off"
                          spellcheck={false}
                        />
                        <button class="provider-key-save" onClick={() => void saveKey()} disabled={saving() || !apiKey().trim()}>
                          {saving() ? "Saving…" : item.stored ? "Replace" : "Save"}
                        </button>
                      </div>
                      <div class="provider-key-meta">
                        <span>{item.configured ? `Active source: ${item.source ?? "configured"}` : `Environment variable: ${item.envVariable}`}</span>
                        <Show when={item.stored}>
                          <button class="provider-key-remove" onClick={() => void removeKey()} disabled={saving()}>Remove stored key</button>
                        </Show>
                      </div>
                    </Show>
                    <Show when={!item.manageable && !item.oauthSupported}>
                      <p class="settings-panel__hint">This provider requires external authentication that is not configurable here.</p>
                    </Show>
                  </div>
                  <Show when={error()}><div class="settings-message is-error">{error()}</div></Show>
                  <Show when={notice()}><div class="settings-message is-success">{notice()}</div></Show>
                  <Show when={item.configured}>
                    <div class="modal-model-group-label">{providerName()} · {providerModels().length} models</div>
                    <For each={providerModels()}>
                      {(m) => (
                        <button
                          class={`modal-model-item ${isActiveModel(providerName(), m.id) ? "is-active" : ""}`}
						  onClick={() => setSelectedModel({ ...m, provider: providerName() })}
                        >
                          {m.name}
                        </button>
                      )}
                    </For>
                  </Show>
                </>
              )}
            </Show>
          </div>
        )}
      </Show>
      <Show when={!provider() && error()}><div class="settings-message is-error">{error()}</div></Show>
    </div>
  )
}

function AppearancePanel() {
  return (
    <div class="settings-panel">
      <p class="settings-panel__hint">Theme is saved to this browser and reapplied on load.</p>
      <div class="modal-theme-grid">
        <For each={THEMES}>
          {(t) => (
            <button
              class={`modal-theme-card ${theme() === t.id ? "is-active" : ""}`}
              onClick={() => setTheme(t.id)}
              title={t.name}
              aria-pressed={theme() === t.id}
            >
              <span class="modal-theme-swatch" style={{ background: t.surface }}>
                <span class="modal-theme-swatch__dot" style={{ background: t.accent, color: t.accent }} />
              </span>
              <span class="modal-theme-name">{t.name}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

function ConnectionPanel() {
  const meta = () => CONN_META[connState()]
  return (
    <div class="settings-panel">
      <p class="settings-panel__hint">Live status of the link between this UI and the DeepScience server.</p>
      <div class="settings-status">
        <span class="settings-status__pulse" style={{ background: meta().color, color: meta().color }} />
        <div class="settings-status__body">
          <span class="settings-status__title" style={{ color: meta().color }}>{meta().label}</span>
          <span class="settings-status__desc">{meta().desc}</span>
        </div>
      </div>
      <div class="settings-facts">
        <div class="settings-facts__row"><span class="settings-facts__k">Agents online</span><span class="settings-facts__v">{agents().length}</span></div>
        <div class="settings-facts__row"><span class="settings-facts__k">Models available</span><span class="settings-facts__v">{modelCount()}</span></div>
        <div class="settings-facts__row"><span class="settings-facts__k">Active agent</span><span class="settings-facts__v">{selectedAgent()}</span></div>
      </div>
    </div>
  )
}

function ConnectorsPanel() {
  const [catalog, setCatalog] = createSignal<ConnectorCatalog | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [testing, setTesting] = createSignal(false)
  const [showForm, setShowForm] = createSignal(false)
  const [name, setName] = createSignal("")
  const [transport, setTransport] = createSignal<"stdio" | "http">("stdio")
  const [target, setTarget] = createSignal("")
  const [args, setArgs] = createSignal("")
  const [environment, setEnvironment] = createSignal("")
  const [cwd, setCwd] = createSignal("")
  const [headers, setHeaders] = createSignal("")
  const [auth, setAuth] = createSignal<"auto" | "none" | "bearer" | "oauth">("auto")
  const [bearerTokenEnv, setBearerTokenEnv] = createSignal("")
  const [lifecycle, setLifecycle] = createSignal<"lazy" | "eager" | "keep-alive">("lazy")
  const [idleTimeout, setIdleTimeout] = createSignal("10")
  const [requestTimeout, setRequestTimeout] = createSignal("30000")
  const [excludeTools, setExcludeTools] = createSignal("")
  const [exposeResources, setExposeResources] = createSignal(true)
  const [debug, setDebug] = createSignal(false)
  const [testResult, setTestResult] = createSignal<ConnectorTestResult | null>(null)
  const [error, setError] = createSignal("")
  const [notice, setNotice] = createSignal("")

  const directory = () => workspaceSelection()?.directory ?? ""
  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setCatalog(await api.fetchConnectors())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  onMount(() => void load())

  const parseRecord = (value: string, label: string): Record<string, string> | undefined => {
    const result: Record<string, string> = {}
    for (const rawLine of value.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue
      const separator = line.indexOf("=")
      if (separator <= 0) {
        setError(`${label} must use one KEY=VALUE entry per line.`)
        return undefined
      }
      result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
    }
    return result
  }

  const buildDefinition = (): ConnectorDefinition | undefined => {
    setError("")
    const env = parseRecord(environment(), "Environment")
    if (!env) return undefined
    const parsedHeaders = parseRecord(headers(), "Headers")
    if (!parsedHeaders) return undefined
    const timeout = Number(requestTimeout())
    const idle = Number(idleTimeout())
    if (!Number.isFinite(timeout) || timeout <= 0) {
      setError("Request timeout must be a positive number of milliseconds.")
      return undefined
    }
    if (!Number.isFinite(idle) || idle < 0) {
      setError("Idle timeout must be zero or a positive number of minutes.")
      return undefined
    }
    const definition: ConnectorDefinition = {
      lifecycle: lifecycle(),
      idleTimeout: idle,
      requestTimeoutMs: timeout,
      exposeResources: exposeResources(),
      excludeTools: excludeTools().split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      debug: debug(),
    }
    if (transport() === "stdio") {
      definition.command = target().trim()
      definition.args = args().split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
      if (Object.keys(env).length > 0) definition.env = env
      if (cwd().trim()) definition.cwd = cwd().trim()
    } else {
      definition.url = target().trim()
      if (Object.keys(parsedHeaders).length > 0) definition.headers = parsedHeaders
      if (auth() === "none") definition.auth = false
      if (auth() === "oauth") definition.auth = "oauth"
      if (auth() === "bearer") {
        definition.auth = "bearer"
        definition.bearerTokenEnv = bearerTokenEnv().trim()
      }
    }
    return definition
  }

  const resetForm = () => {
    setName(""); setTarget(""); setArgs(""); setEnvironment(""); setCwd(""); setHeaders("")
    setAuth("auto"); setBearerTokenEnv(""); setLifecycle("lazy"); setIdleTimeout("10")
    setRequestTimeout("30000"); setExcludeTools(""); setExposeResources(true); setDebug(false); setTestResult(null)
  }

  const test = async () => {
    setNotice("")
    setTestResult(null)
    const definition = buildDefinition()
    if (!definition || !name().trim() || !target().trim()) return
    setTesting(true)
    try {
      setTestResult(await api.testConnector(directory(), name().trim(), definition))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setTesting(false)
    }
  }

  const add = async () => {
    setNotice("")
    const definition = buildDefinition()
    if (!definition) return
    setSaving(true)
    try {
      setCatalog(await api.saveConnector(name().trim(), definition))
      resetForm()
      setShowForm(false)
      setNotice("Connector saved. New Sessions will discover it on demand.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (connectorName: string) => {
    setError("")
    setNotice("")
    try {
      setCatalog(await api.deleteConnector(connectorName))
      setNotice(`${connectorName} removed. Existing running Sessions are unchanged.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div class="settings-panel">
      <p class="settings-panel__hint">Global MCP connectors shared by every DeepScience Workspace. They remain disconnected until the Agent selects the lazy <code>mcp</code> tool.</p>
      <Show when={error()}><div class="settings-message is-error">{error()}</div></Show>
      <Show when={notice()}><div class="settings-message is-success">{notice()}</div></Show>
      <Show when={catalog()} keyed>
        {(value) => (
          <div class="connector-config-meta">
            <span>{value.connectors.length} configured</span>
            <code>{value.configPath}</code>
          </div>
        )}
      </Show>
      <Show when={!showForm()}>
        <button class="connector-add-trigger" onClick={() => setShowForm(true)}>+ Add server</button>
      </Show>
      <Show when={showForm()}>
        <div class="connector-form">
          <div class="connector-form__header">
            <div>
              <div class="connector-form__title">Add server</div>
              <div class="connector-form__subtitle">Configure a local stdio process or remote MCP endpoint.</div>
            </div>
            <button class="connector-card__remove" onClick={() => { resetForm(); setShowForm(false) }}>Cancel</button>
          </div>
          <div class="connector-field">
            <label>Name</label>
            <input value={name()} onInput={(event) => setName(event.currentTarget.value)} placeholder="e.g. filesystem" />
          </div>
          <div class="connector-field">
            <label>Transport</label>
            <select value={transport()} onChange={(event) => { setTransport(event.currentTarget.value as "stdio" | "http"); setTestResult(null) }}>
              <option value="stdio">Local command (stdio)</option>
              <option value="http">Remote URL (Streamable HTTP / SSE)</option>
            </select>
          </div>
          <Show when={transport() === "stdio"} fallback={
            <>
              <div class="connector-field"><label>URL</label><input value={target()} onInput={(event) => setTarget(event.currentTarget.value)} placeholder="https://example.com/mcp" /></div>
              <div class="connector-field"><label>Headers</label><textarea value={headers()} onInput={(event) => setHeaders(event.currentTarget.value)} placeholder={'X-API-Key=${MCP_API_KEY}\nX-Workspace=research'} /><small>One KEY=VALUE header per line. Environment references are supported.</small></div>
              <div class="connector-form__row connector-form__row--three">
                <div class="connector-field"><label>Authentication</label><select value={auth()} onChange={(event) => setAuth(event.currentTarget.value as "auto" | "none" | "bearer" | "oauth")}><option value="auto">Auto detect</option><option value="none">None</option><option value="bearer">Bearer token</option><option value="oauth">OAuth</option></select></div>
                <Show when={auth() === "bearer"}><div class="connector-field connector-field--wide"><label>Token environment variable</label><input value={bearerTokenEnv()} onInput={(event) => setBearerTokenEnv(event.currentTarget.value)} placeholder="MCP_ACCESS_TOKEN" /></div></Show>
              </div>
            </>
          }>
            <div class="connector-field"><label>Command</label><input value={target()} onInput={(event) => setTarget(event.currentTarget.value)} placeholder="npx" /></div>
            <div class="connector-field"><label>Arguments</label><textarea value={args()} onInput={(event) => setArgs(event.currentTarget.value)} placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/path/to/project'} /><small>One argument per line; spaces inside one line remain part of that argument.</small></div>
            <div class="connector-field"><label>Environment</label><textarea value={environment()} onInput={(event) => setEnvironment(event.currentTarget.value)} placeholder={'API_KEY=${MY_API_KEY}\nLOG_LEVEL=info'} /><small>One KEY=VALUE per line, merged into the server process environment.</small></div>
            <div class="connector-field"><label>Working directory</label><input value={cwd()} onInput={(event) => setCwd(event.currentTarget.value)} placeholder="Project root by default" /></div>
          </Show>
          <details class="connector-advanced">
            <summary>Lifecycle and advanced settings</summary>
            <div class="connector-form__row connector-form__row--three">
              <div class="connector-field"><label>Lifecycle</label><select value={lifecycle()} onChange={(event) => setLifecycle(event.currentTarget.value as "lazy" | "eager" | "keep-alive")}><option value="lazy">Lazy</option><option value="eager">Eager</option><option value="keep-alive">Keep alive</option></select></div>
              <div class="connector-field"><label>Idle timeout (minutes)</label><input type="number" min="0" value={idleTimeout()} onInput={(event) => setIdleTimeout(event.currentTarget.value)} /></div>
              <div class="connector-field"><label>Request timeout (ms)</label><input type="number" min="1" value={requestTimeout()} onInput={(event) => setRequestTimeout(event.currentTarget.value)} /></div>
            </div>
            <div class="connector-field"><label>Excluded tools</label><textarea value={excludeTools()} onInput={(event) => setExcludeTools(event.currentTarget.value)} placeholder={'dangerous_tool\nserver_prefixed_tool'} /><small>One original or prefixed tool name per line.</small></div>
            <label class="connector-check"><input type="checkbox" checked={exposeResources()} onChange={(event) => setExposeResources(event.currentTarget.checked)} /><span>Expose MCP resources to the Agent</span></label>
            <label class="connector-check"><input type="checkbox" checked={debug()} onChange={(event) => setDebug(event.currentTarget.checked)} /><span>Show server stderr for debugging</span></label>
          </details>
          <Show when={testResult()} keyed>{(result) => <div class="connector-test-result"><strong>Connection successful</strong><span>{result.server.name ?? "MCP server"}{result.server.version ? ` · v${result.server.version}` : ""}</span><span>{result.toolCount} tools · {result.resourceCount} resources · {result.durationMs} ms</span></div>}</Show>
          <div class="connector-form__actions">
            <button class="connector-test" disabled={testing() || saving() || !name().trim() || !target().trim()} onClick={() => void test()}>{testing() ? "Testing…" : "Test connection"}</button>
            <button class="provider-key-save" disabled={saving() || testing() || !name().trim() || !target().trim() || (auth() === "bearer" && !bearerTokenEnv().trim())} onClick={() => void add()}>{saving() ? "Saving…" : "Save server"}</button>
          </div>
        </div>
      </Show>
      <Show when={!loading()} fallback={<div class="settings-empty">Loading Connectors…</div>}>
        <Show when={(catalog()?.connectors.length ?? 0) > 0} fallback={<div class="settings-empty">No project Connectors configured.</div>}>
          <div class="connector-list">
            <For each={catalog()?.connectors ?? []}>
              {(connector) => (
                <div class="connector-card">
                  <span class="connector-card__dot" />
                  <div class="connector-card__body">
                    <div class="connector-card__title">
                      <strong>{connector.name}</strong>
                      <span>{connector.lifecycle === "lazy" ? "On demand" : connector.lifecycle}</span>
                    </div>
                    <code>{connector.url ?? [connector.command, ...(connector.args ?? [])].filter(Boolean).join(" ")}</code>
                  </div>
                  <button class="connector-card__remove" onClick={() => void remove(connector.name)}>Remove</button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <details class="connector-help"><summary>How does this work?</summary><p>Local servers run as child processes. Remote servers use Streamable HTTP with legacy SSE fallback. DeepScience exposes their tools through one lazy <code>mcp</code> gateway; a configured server is not connected until the Agent needs it. Configuration is stored globally in <code>~/.deepscience/mcp.json</code>; new or restarted Sessions pick up changes.</p></details>
    </div>
  )
}

function AboutPanel() {
  return (
    <div class="settings-panel">
      <div class="modal-current">
        <span class="modal-current__name">{capabilities().brand}</span>
        <span class="modal-current__desc">AI research agent powered by pi · v{capabilities().version}</span>
      </div>
      <p class="modal-about">An AI research collaborator built to reason, query biological databases, and iterate alongside you across proteins, genes, pathways, and literature.</p>
      <div class="settings-facts">
        <div class="settings-facts__row"><span class="settings-facts__k">Agents</span><span class="settings-facts__v">{agents().length}</span></div>
        <div class="settings-facts__row"><span class="settings-facts__k">Models</span><span class="settings-facts__v">{modelCount()}</span></div>
        <div class="settings-facts__row"><span class="settings-facts__k">Connection</span><span class="settings-facts__v">{CONN_META[connState()].label}</span></div>
        <div class="settings-facts__row"><span class="settings-facts__k">Theme</span><span class="settings-facts__v">{theme()}</span></div>
      </div>
    </div>
  )
}

/* ── Registry ────────────────────────────────────────────────────────── */

type PanelId = "agent" | "model" | "connectors" | "appearance" | "connection" | "about"
type SectionId = "workspace" | "system"

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "system", label: "System" },
]

const PANELS: { id: PanelId; title: string; icon: string; section: SectionId }[] = [
  { id: "agent", title: "Agent", icon: "agent", section: "workspace" },
  { id: "model", title: "Model", icon: "model", section: "workspace" },
  { id: "connectors", title: "Connectors", icon: "connectors", section: "workspace" },
  { id: "appearance", title: "Appearance", icon: "appearance", section: "system" },
  { id: "connection", title: "Connection", icon: "connection", section: "system" },
  { id: "about", title: "About", icon: "about", section: "system" },
]

function visiblePanels(): PanelId[] {
  return PANELS
    .filter((p) => {
      if (p.id === "appearance") return settingsPanelVisible("general")
      if (p.id === "connectors") return featureEnabled("mcpManagement")
      return true
    })
    .map((p) => p.id)
}

/* ── Shell ───────────────────────────────────────────────────────────── */

export default function SettingsModal() {
  const close = () => setSettingsOpen(false)

  const [history, setHistory] = createSignal<PanelId[]>(["agent"])
  const [cursor, setCursor] = createSignal(0)
  const current = createMemo(() => history()[cursor()])
  const canBack = createMemo(() => cursor() > 0)
  const canForward = createMemo(() => cursor() < history().length - 1)
  const visible = createMemo(() => visiblePanels())

  const navigate = (id: PanelId) => {
    if (history()[cursor()] === id) return
    const next = history().slice(0, cursor() + 1)
    next.push(id)
    setHistory(next)
    setCursor(next.length - 1)
  }
  const back = () => canBack() && setCursor(cursor() - 1)
  const forward = () => canForward() && setCursor(cursor() + 1)

  // Close on Escape, stay inside modal.
  createEffect(() => {
    if (!settingsOpen()) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKeyDown)
    onCleanup(() => document.removeEventListener("keydown", onKeyDown))
  })

  return (
    <Show when={settingsOpen()}>
      <div class="modal-backdrop" onClick={close}>
        <div
          class="settings-frame"
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Left rail ── */}
          <nav class="settings-rail" aria-label="Settings sections">
            <div class="settings-rail__scroll">
              <For each={SECTIONS}>
                {(section) => (
                  <div class="settings-rail__section">
                    <span class="settings-rail__label">{section.label}</span>
                    <For each={PANELS.filter((p) => p.section === section.id && visible().includes(p.id))}>
                      {(panel) => (
                        <button
                          class={`settings-rail__btn ${current() === panel.id ? "is-active" : ""}`}
                          onClick={() => navigate(panel.id)}
                          aria-current={current() === panel.id ? "page" : undefined}
                        >
                          <RailIcon name={panel.icon} />
                          <span>{panel.title}</span>
                        </button>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
            <div class="settings-rail__footer">
              <div class="settings-rail__footer-name">DeepScience</div>
              <div class="settings-rail__footer-sub">AI research agent</div>
            </div>
          </nav>

          {/* ── Right column ── */}
          <div class="settings-main">
            <header class="settings-header">
              <div class="settings-header__nav">
                <button class="settings-header__btn" onClick={back} disabled={!canBack()} aria-label="Back">
                  <Chevron dir="left" />
                </button>
                <button class="settings-header__btn" onClick={forward} disabled={!canForward()} aria-label="Forward">
                  <Chevron dir="right" />
                </button>
                <span class="settings-header__title">{PANELS.find((p) => p.id === current())?.title ?? "Settings"}</span>
              </div>
              <button class="settings-header__btn" onClick={close} aria-label="Close settings">
                <CloseIcon />
              </button>
            </header>

            <div class="settings-body">
              <Switch fallback={<div />}>
                <Match when={current() === "agent"}><AgentPanel /></Match>
                <Match when={current() === "model"}><ModelPanel /></Match>
                <Match when={current() === "connectors"}><ConnectorsPanel /></Match>
                <Match when={current() === "appearance"}><AppearancePanel /></Match>
                <Match when={current() === "connection"}><ConnectionPanel /></Match>
                <Match when={current() === "about"}><AboutPanel /></Match>
              </Switch>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
