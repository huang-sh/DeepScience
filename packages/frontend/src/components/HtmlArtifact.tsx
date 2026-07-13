const ARTIFACT_CSP = [
	"default-src 'none'",
	"img-src data: blob:",
	"media-src data: blob:",
	"font-src data:",
	"style-src 'unsafe-inline'",
	"script-src 'none'",
	"connect-src 'none'",
	"form-action 'none'",
	"base-uri 'none'",
	"object-src 'none'",
	"frame-src 'none'",
	"navigate-to 'none'",
].join("; ");

export function unwrapArtifactHtml(value: string): string {
	const fenced = value.match(/^\s*```html\s*\n([\s\S]*?)\n```\s*$/i);
	return (fenced?.[1] ?? value).trim();
}

export function sandboxedHtmlDocument(value: string): string {
	const source = unwrapArtifactHtml(value)
		.replace(/<!doctype[^>]*>/gi, "")
		.replace(/<\/?(?:html|head|body)(?:\s[^>]*)?>/gi, "");
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}">
<meta name="referrer" content="no-referrer">
<style>
  :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  html, body { min-height: 100%; margin: 0; }
  body { padding: 16px; color: #18212f; background: #fff; line-height: 1.5; overflow-wrap: anywhere; }
  img, svg, canvas, video { max-width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 9px; border: 1px solid #d9dee7; text-align: left; }
  th { background: #f3f6f8; }
  pre { max-width: 100%; overflow: auto; white-space: pre-wrap; }
</style>
</head>
<body>${source}</body>
</html>`;
}

export default function HtmlArtifact(props: { html: string; title?: string }) {
	return (
		<section class="artifact-html" aria-label={props.title ?? "Sandboxed HTML artifact"}>
			<div class="artifact-html__notice">
				<span>HTML</span>
				Sandboxed preview · scripts and external resources disabled
			</div>
			<iframe
				class="artifact-html__frame"
				title={props.title ?? "HTML artifact preview"}
				sandbox=""
				referrerpolicy="no-referrer"
				srcdoc={sandboxedHtmlDocument(props.html)}
			/>
		</section>
	);
}
