import { createSignal, For } from "solid-js"
import { sendMessage, streaming, connState, effectiveVisionModel, imageInputUnavailableMessage } from "../store"
import ComposerSwitchers from "./ComposerSwitchers"
import { clipboardImageFiles, loadComposerImages, type ComposerImage } from "../image-input"
import { ImageAttachmentTray, ImageUploadButton } from "./ImageInput"

const SUGGESTIONS = [
  "Explain the role of TP53 in cancer pathways",
  "Find UniProt annotations for BRCA1",
  "Compare KEGG pathways for apoptosis vs autophagy",
  "Summarize recent PubMed papers on CRISPR base editing",
  "Suggest a target for small-molecule inhibition",
]

export default function HomeLanding() {
  const [draft, setDraft] = createSignal("")
  const [images, setImages] = createSignal<ComposerImage[]>([])
  const [imageError, setImageError] = createSignal("")

  const canSend = () => (draft().trim().length > 0 || images().length > 0) && !streaming() && connState() === "connected"

  const submit = () => {
    if (!canSend()) return
	if (images().length > 0 && !effectiveVisionModel()) {
		setImageError(imageInputUnavailableMessage())
		return
	}
    const value = draft()
	const attached = images().map(({ data, mimeType, name }) => ({ data, mimeType, name }))
    setDraft("")
	setImages([])
	setImageError("")
    void sendMessage(value, attached)
  }

  const addImages = async (files: File[]) => {
	if (files.length === 0) return
	if (!effectiveVisionModel()) {
		setImageError(imageInputUnavailableMessage())
		return
	}
	const loaded = await loadComposerImages(files, images())
	if (loaded.images.length > 0) setImages((current) => [...current, ...loaded.images])
	setImageError(loaded.errors.join(" "))
  }

  const onPaste = (event: ClipboardEvent) => {
	const files = clipboardImageFiles(event)
	if (files.length > 0) void addImages(files)
	}

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <main class="home-landing">
      <div class="home-landing__hero">
        <div class="home-landing__headline">
          <img class="home-landing__mark" src="/deepscience-logo.png" alt="" aria-hidden="true" />
          <h1>DeepScience</h1>
        </div>
        <p class="home-landing__copy">
          Your AI research collaborator — built to reason, query biological databases,
          and iterate alongside you across proteins, genes, pathways, and literature.
        </p>
      </div>

      <section class="home-prompt" aria-label="Start a research task">
        <div class="home-prompt__body">
          <label class="home-prompt__question" for="landing-input">
            What scientific task can I help you with today?
          </label>
          <textarea
            id="landing-input"
            class="home-prompt__textarea"
            placeholder="Describe the analysis, dataset, or question you want to explore..."
            value={draft()}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={onKeyDown}
			onPaste={onPaste}
            aria-label="Research task prompt"
          />
		  <ImageAttachmentTray images={images()} error={imageError()} disabled={streaming()} onRemove={(id) => setImages((current) => current.filter((image) => image.id !== id))} />
        </div>

        <div class="home-prompt__footer">
		  <div class="home-prompt__controls">
			<ImageUploadButton disabled={streaming() || connState() !== "connected" || images().length >= 4} onFiles={(files) => void addImages(files)} />
			<ComposerSwitchers />
		  </div>

          <button
            class="home-prompt__send"
            disabled={!canSend()}
            onClick={submit}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </section>

      <div class="home-landing__chips" role="list" aria-label="Example tasks">
        <For each={SUGGESTIONS}>
          {(chip) => (
            <button
              class="home-landing__chip"
              onClick={() => setDraft(chip)}
              role="listitem"
            >
              {chip}
            </button>
          )}
        </For>
      </div>
    </main>
  )
}
