import { For, Show } from "solid-js";
import { Marked, Renderer } from "marked";
import markedKatex from "marked-katex-extension";
import { extractArtifactReferences } from "../result";

export interface MarkdownProps {
	text: string;
	onOpenFile?: (path: string) => void;
	sessionId?: string;
}

const MAX_CSV_ROWS = 200;
const MAX_CSV_COLUMNS = 50;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let value = "";
	let quoted = false;

	for (let index = 0; index < text.length; index++) {
		const character = text[index];
		if (character === '"') {
			if (quoted && text[index + 1] === '"') {
				value += '"';
				index++;
			} else {
				quoted = !quoted;
			}
			continue;
		}
		if (!quoted && character === delimiter) {
			row.push(value);
			value = "";
			continue;
		}
		if (!quoted && (character === "\n" || character === "\r")) {
			if (character === "\r" && text[index + 1] === "\n") index++;
			row.push(value);
			rows.push(row);
			row = [];
			value = "";
			if (rows.length >= MAX_CSV_ROWS) break;
			continue;
		}
		value += character;
	}
	if (rows.length < MAX_CSV_ROWS && (value || row.length > 0)) {
		row.push(value);
		rows.push(row);
	}
	return rows.map((item) => item.slice(0, MAX_CSV_COLUMNS));
}

export function renderDelimitedTable(text: string, delimiter: "," | "\t"): string {
	const rows = parseDelimited(text.trim(), delimiter);
	if (rows.length === 0) return '<div class="artifact-csv-empty">Empty data block</div>';
	const columnCount = Math.max(...rows.map((row) => row.length));
	const normalized = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
	const [header, ...body] = normalized;
	const headerHtml = `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`;
	const bodyHtml = `<tbody>${body
		.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
		.join("")}</tbody>`;
	return `<div class="artifact-data-table" role="region" aria-label="Delimited data preview" tabindex="0"><table>${headerHtml}${bodyHtml}</table></div>`;
}

const renderer = new Renderer();
renderer.html = ({ text }) => `<p>${escapeHtml(text)}</p>`;
renderer.code = ({ text, lang }) => {
	const language = (lang ?? "").trim().toLowerCase().split(/\s+/)[0];
	if (language === "csv") return renderDelimitedTable(text, ",");
	if (language === "tsv") return renderDelimitedTable(text, "\t");
	const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
	return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
};
renderer.link = function ({ href, title, tokens }) {
	const label = this.parser.parseInline(tokens);
	if (!/^https?:\/\//i.test(href)) return label;
	const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
	return `<a href="${escapeHtml(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}</a>`;
};
renderer.image = () => "";

const markdownParser = new Marked(
	{ gfm: true, breaks: false, renderer },
	markedKatex({ throwOnError: false, nonStandard: true }),
);

export function renderMarkdown(text: string): string {
	return markdownParser.parse(text, { async: false });
}

export default function Markdown(props: MarkdownProps) {
	const references = () => extractArtifactReferences(props.text, props.sessionId);
	const remoteImages = () => extractRemoteImages(props.text);
	const textWithoutImageDirectives = () => props.text.replace(/!\[[^\]]*\]\([^)\s]+\)/g, "");
	return (
		<div class="md-with-results">
			<div class="md" innerHTML={renderMarkdown(textWithoutImageDirectives())} />
			<Show when={remoteImages().length > 0 || references().length > 0}>
				<div class="result-references" aria-label="Referenced output files">
					<For each={remoteImages()}>
						{(item) => (
							<a class="result-image-thumb" href={item.src} target="_blank" rel="noopener" title="Open image result">
								<img src={item.src} alt={item.alt} loading="lazy" referrerpolicy="no-referrer" draggable={false} />
							</a>
						)}
					</For>
					<For each={references()}>
						{(reference) =>
							reference.kind === "image" ? (
								<button
									class="result-image-thumb"
									title="Preview image result"
									onClick={() => props.onOpenFile?.(reference.path)}
								>
									<img src={reference.src} alt={reference.label} loading="lazy" draggable={false} />
								</button>
							) : props.onOpenFile ? (
								<button class="result-file-link" onClick={() => props.onOpenFile?.(reference.path)}>
									<span>{reference.label}</span>
									<small>Preview file</small>
								</button>
							) : (
								<a class="result-file-link" href={reference.src} target="_blank" rel="noopener">
									<span>{reference.label}</span>
									<small>Open file</small>
								</a>
							)
						}
					</For>
				</div>
			</Show>
		</div>
	);
}

function extractRemoteImages(text: string): Array<{ src: string; alt: string }> {
	const images: Array<{ src: string; alt: string }> = [];
	for (const match of text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)) {
		try {
			const url = new URL(match[2]);
			if (url.protocol === "http:" || url.protocol === "https:") {
				images.push({ src: url.toString(), alt: match[1].trim() || "Agent result image" });
			}
		} catch {
			/* ignore malformed image URLs */
		}
	}
	return images;
}
