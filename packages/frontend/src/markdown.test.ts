import assert from "node:assert";
import { describe, it } from "node:test";
import { parseDelimited, renderDelimitedTable, renderMarkdown } from "./components/Markdown.tsx";

describe("artifact Markdown rendering", () => {
	it("renders GFM tables", () => {
		const html = renderMarkdown("| Gene | Score |\n| --- | ---: |\n| TP53 | 0.98 |");
		assert.match(html, /<table>/);
		assert.match(html, /<th>Gene<\/th>/);
		assert.match(html, /<td>TP53<\/td>/);
	});

	it("renders CSV fences as bounded data tables", () => {
		const html = renderMarkdown('```csv\ngene,description\nTP53,"tumor, suppressor"\n```');
		assert.match(html, /artifact-data-table/);
		assert.match(html, /<td>tumor, suppressor<\/td>/);
	});

	it("renders display equations with KaTeX", () => {
		const html = renderMarkdown("$$E = mc^2$$");
		assert.match(html, /class="katex-display"/);
	});

	it("escapes raw HTML from agent output", () => {
		const html = renderMarkdown('<script>alert("unsafe")</script>');
		assert.doesNotMatch(html, /<script>/);
		assert.match(html, /&lt;script&gt;/);
	});
});

describe("delimited data parsing", () => {
	it("supports quotes, escaped quotes, and embedded delimiters", () => {
		assert.deepStrictEqual(parseDelimited('name,value\n"alpha,beta","a""b"', ","), [
			["name", "value"],
			["alpha,beta", 'a"b'],
		]);
	});

	it("escapes data cells", () => {
		const html = renderDelimitedTable("name,value\nx,<img src=x onerror=alert(1)>", ",");
		assert.doesNotMatch(html, /<img/);
		assert.match(html, /&lt;img/);
	});
});
