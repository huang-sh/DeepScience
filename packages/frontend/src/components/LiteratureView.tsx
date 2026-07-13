import { createSignal } from "solid-js"
import { sendMessage, setActiveView, streaming, connState } from "../store"

export default function LiteratureView() {
  const [query, setQuery] = createSignal("")

  const canSearch = () =>
    query().trim().length > 0 && !streaming() && connState() === "connected"

  const submit = () => {
    const value = query().trim()
    if (!value) return
    setQuery("")
    setActiveView("workspace")
    void sendMessage(`Search PubMed for: ${value}`)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div class="view-root">
      <header class="view-header">
        <h1 class="view-title">Literature Search</h1>
        <p class="view-subtitle">
          Search PubMed through the workspace agent. Results stream back into the chat.
        </p>
      </header>

      <div class="lit-search-bar">
        <input
          class="lit-search-input"
          type="text"
          placeholder="e.g. CRISPR base editing off-target"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          aria-label="PubMed search query"
        />
        <button
          class="lit-search-btn"
          onClick={submit}
          disabled={!canSearch()}
        >
          Search
        </button>
      </div>

      <div class="lit-empty">
        Enter a query above to search PubMed. The workspace agent will run the
        search and surface matching abstracts.
      </div>
    </div>
  )
}
