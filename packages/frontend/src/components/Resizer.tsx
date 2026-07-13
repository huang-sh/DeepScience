import { createSignal, onCleanup } from "solid-js"

export default function Resizer(props: {
  width: number
  onResize: (delta: number) => void
  onReset: () => void
  side?: "left" | "right"
}) {
  const [active, setActive] = createSignal(false)
  let startX = 0

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setActive(true)
    startX = e.clientX
    document.body.classList.add("is-resizing")
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    document.addEventListener("pointercancel", onPointerUp)
  }

  const onPointerMove = (e: PointerEvent) => {
    const delta = props.side === "right" ? startX - e.clientX : e.clientX - startX
    startX = e.clientX
    props.onResize(delta)
  }

  const onPointerUp = () => {
    setActive(false)
    document.body.classList.remove("is-resizing")
    document.removeEventListener("pointermove", onPointerMove)
    document.removeEventListener("pointerup", onPointerUp)
    document.removeEventListener("pointercancel", onPointerUp)
  }

  onCleanup(() => {
    document.body.classList.remove("is-resizing")
    document.removeEventListener("pointermove", onPointerMove)
    document.removeEventListener("pointerup", onPointerUp)
    document.removeEventListener("pointercancel", onPointerUp)
  })

  return (
    <div
      class={`resizer ${active() ? "is-active" : ""} ${props.side === "right" ? "resizer--right" : ""}`}
      role="separator"
      aria-orientation="vertical"
      tabindex={0}
      title="Drag to resize, double-click to reset"
      aria-label={`${props.side === "right" ? "Trace" : "Project"} panel resize handle`}
      aria-valuenow={props.width}
      onPointerDown={onPointerDown}
      onDblClick={() => props.onReset()}
    />
  )
}
