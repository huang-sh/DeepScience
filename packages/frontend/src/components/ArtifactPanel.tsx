/* ================================================================
   DeepScience frontend — slide-in artifact panel

   Shows the full output of a tool call as typed ToolResultContent
   blocks (text/json/code/markdown/image). Copy works on textual
   content; Escape or the close button dismisses the panel.

   This is a non-modal slide-in panel (role="complementary"), not a
   dialog, because focus trapping is not implemented.
   ================================================================ */

import { Show, createSignal, createEffect, onCleanup } from "solid-js"
import { activeArtifact, activeSessionId, closeArtifact } from "../store"
import ResultRenderer from "./ResultRenderer"
import { summarizeContent } from "../result"

/** Slide-in panel showing the full output of a tool call. */
export default function ArtifactPanel() {
  const [copied, setCopied] = createSignal(false)

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  createEffect(() => {
    if (!activeArtifact()) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeArtifact()
    }
    document.addEventListener("keydown", onKeyDown)
    onCleanup(() => document.removeEventListener("keydown", onKeyDown))
  })

  return (
    <Show when={activeArtifact()}>
      {(artifact) => {
        const textToCopy = () =>
          summarizeContent(artifact().content, Number.MAX_SAFE_INTEGER) || artifact().output || ""

        return (
          <aside
            class="artifact-panel"
            role="complementary"
            aria-label={`Artifact preview: ${artifact().title}`}
          >
            <header class="artifact-panel__header">
              <div class="artifact-panel__title-group">
                <div class="artifact-panel__eyebrow">{artifact().tool}</div>
                <div class="artifact-panel__title">{artifact().title}</div>
              </div>
              <div class="artifact-panel__actions">
                <Show when={textToCopy()}>
                  <button
                    class="artifact-panel__copy"
                    title={copied() ? "Copied" : "Copy"}
                    aria-label={copied() ? "Copied" : "Copy textual content to clipboard"}
                    onClick={() => void copy(textToCopy())}
                  >
                    <Show
                      when={copied()}
                      fallback={
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <rect x="5" y="5" width="8" height="8" rx="1.5" />
                          <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
                        </svg>
                      }
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 8.5L6.5 12L13 4" />
                      </svg>
                    </Show>
                  </button>
                </Show>
                <button
                  class="artifact-panel__close"
                  title="Close"
                  aria-label="Close artifact preview"
                  onClick={() => closeArtifact()}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 4L12 12M12 4L4 12" />
                  </svg>
                </button>
              </div>
            </header>

            <div class="artifact-panel__body">
              <ResultRenderer
                content={artifact().content}
                output={artifact().output}
                preview={false}
				sessionId={activeSessionId() ?? undefined}
                ariaLabel={`Full result for ${artifact().title}`}
              />
            </div>
          </aside>
        )
      }}
    </Show>
  )
}
