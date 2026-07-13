/* @refresh reload */
import { render } from "solid-js/web"
import "katex/dist/katex.min.css"
import App from "./App"
import "./styles/global.css"

const root = document.getElementById("root")
if (!root) throw new Error("#root not found")

render(() => <App />, root)
