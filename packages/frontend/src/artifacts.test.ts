import assert from "node:assert";
import { describe, it } from "node:test";
import { collectSessionArtifacts } from "./artifacts.ts";
import { sandboxedHtmlDocument, unwrapArtifactHtml } from "./components/HtmlArtifact.tsx";
import { describeStructureAtom, extractEmbeddedStructure, structureFormatFromFilename } from "./structure.ts";
import type { ChatMessage } from "./types.ts";

describe("collectSessionArtifacts", () => {
	it("collects only successful artifact tool publications", () => {
		const messages: ChatMessage[] = [
			{
				id: "assistant-1",
				role: "assistant",
				timestamp: 10,
				parts: [{ kind: "text", text: "$$E = mc^2$$" }],
			},
			{
				id: "assistant-2",
				role: "assistant",
				timestamp: 20,
				parts: [
					{
						kind: "tool",
						id: "tool-1",
						tool: "python",
						status: "done",
						content: [{ type: "text", text: "Saved plot to outputs/figure.png" }],
					},
				],
			},
			{
				id: "assistant-3",
				role: "assistant",
				timestamp: 30,
				parts: [
					{
						kind: "tool",
						id: "artifact-1",
						tool: "artifact",
						status: "done",
						content: [{ type: "text", text: "## Final figure\n\n![Result](outputs/figure.png)" }],
						details: {
							artifact: {
								title: "Validated result",
								kind: "image",
								files: [{ path: "outputs/figure.png", label: "Result", kind: "image" }],
							},
						},
					},
				],
			},
		];

		const artifacts = collectSessionArtifacts(messages);
		assert.strictEqual(artifacts.length, 1);
		assert.strictEqual(artifacts[0].id, "artifact-1");
		assert.strictEqual(artifacts[0].title, "Validated result");
		assert.strictEqual(artifacts[0].kind, "image");
		assert.deepStrictEqual(
			artifacts[0].files.map((file) => file.path),
			["outputs/figure.png"],
		);
	});

	it("does not duplicate ordinary assistant prose as an artifact", () => {
		const messages: ChatMessage[] = [
			{
				id: "assistant-plain",
				role: "assistant",
				timestamp: 10,
				parts: [{ kind: "text", text: "The analysis completed successfully." }],
			},
		];

		assert.deepStrictEqual(collectSessionArtifacts(messages), []);
	});

	it("does not promote Pi reasoning commentary into final artifacts", () => {
		const artifacts = collectSessionArtifacts([
			{
				id: "assistant-process",
				role: "assistant",
				parts: [
					{ kind: "thinking", id: "thinking", text: "draft hypothesis", turnIndex: 0 },
					{ kind: "text", id: "process", text: "Saved draft to output.md", phase: "process", turnIndex: 0 },
				],
				timestamp: 1,
			},
		]);
		assert.deepStrictEqual(artifacts, []);
	});

	it("does not publish failed artifact calls", () => {
		const artifacts = collectSessionArtifacts([
			{
				id: "assistant-failed",
				role: "assistant",
				timestamp: 1,
				parts: [
					{
						kind: "tool",
						id: "artifact-failed",
						tool: "artifact",
						status: "error",
						content: [{ type: "text", text: "Missing file" }],
					},
				],
			},
		]);
		assert.deepStrictEqual(artifacts, []);
	});

	it("preserves explicitly published HTML artifacts", () => {
		const artifacts = collectSessionArtifacts([
			{
				id: "assistant-html",
				role: "assistant",
				timestamp: 1,
				parts: [
					{
						kind: "tool",
						id: "artifact-html",
						tool: "artifact",
						status: "done",
						content: [{ type: "text", text: "<html><body><h1>Result</h1></body></html>" }],
						details: { artifact: { title: "HTML report", kind: "html", files: [] } },
					},
				],
			},
		]);
		assert.strictEqual(artifacts[0]?.kind, "html");
		assert.strictEqual(artifacts[0]?.title, "HTML report");
	});

	it("accepts the artifact metadata contract from any tool", () => {
		const artifacts = collectSessionArtifacts([
			{
				id: "assistant-extension",
				role: "assistant",
				timestamp: 1,
				parts: [
					{
						kind: "tool",
						id: "extension-publication",
						tool: "custom-analysis",
						status: "done",
						content: [{ type: "text", text: "Extension result" }],
						details: { artifact: { title: "Published by extension", kind: "network", files: [] } },
					},
				],
			},
		]);
		assert.strictEqual(artifacts[0]?.tool, "custom-analysis");
		assert.strictEqual(artifacts[0]?.kind, "network");
		assert.strictEqual(artifacts[0]?.title, "Published by extension");
	});
});

describe("sandboxed HTML artifacts", () => {
	it("unwraps fenced HTML and installs a restrictive CSP before the content", () => {
		assert.strictEqual(unwrapArtifactHtml("```html\n<h1>Result</h1>\n```"), "<h1>Result</h1>");
		const document = sandboxedHtmlDocument(
			'<html><body><script src="https://example.com/x.js"></script></body></html>',
		);
		assert.match(document, /Content-Security-Policy/);
		assert.match(document, /script-src 'none'/);
		assert.match(document, /connect-src 'none'/);
		assert.ok(document.indexOf("Content-Security-Policy") < document.indexOf("example.com"));
	});
});

describe("molecular structure artifacts", () => {
	it("recognizes structure file formats", () => {
		assert.strictEqual(structureFormatFromFilename("model.pdb"), "pdb");
		assert.strictEqual(structureFormatFromFilename("model.mmcif"), "cif");
		assert.strictEqual(structureFormatFromFilename("report.html"), null);
	});

	it("extracts PDB data from legacy 3Dmol HTML", () => {
		const structure = extractEmbeddedStructure(`
			<script>
			var data_0 = \`ATOM      1  N   GLY A   1       0.000   0.000   0.000  1.00 20.00           N\`;
			</script>
		`);
		assert.strictEqual(structure?.format, "pdb");
		assert.match(structure?.data ?? "", /^ATOM/);
	});

	it("formats atom identity and coordinates for interactive inspection", () => {
		assert.deepStrictEqual(
			describeStructureAtom({
				model: 0,
				index: 12,
				serial: 13,
				atom: "CA",
				elem: "C",
				resn: "GLY",
				resi: 7,
				chain: "A",
				x: 1.23456,
				y: -2,
				z: 0,
				b: 18.5,
				bonds: [11, 13],
			}),
			{
				key: "0:12:A:GLY 7:CA",
				atom: "CA",
				element: "C",
				residue: "GLY 7",
				chain: "A",
				serial: "13",
				coordinates: "1.235, -2.000, 0.000",
				bFactor: "18.50",
				bonds: "2",
			},
		);
	});
});
