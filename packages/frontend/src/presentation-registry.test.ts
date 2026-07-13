import assert from "node:assert";
import { describe, it } from "node:test";
import {
	artifactKindClass,
	artifactKindLabel,
	inferArtifactKind,
	readArtifactPublication,
	registerArtifactKind,
} from "./presentation/artifact-registry.ts";
import { registerToolPresenter, toolStatusLabel } from "./presentation/tool-presenters.ts";

describe("frontend presentation registries", () => {
	it("allows an extension to add an artifact kind without changing the panel", () => {
		registerArtifactKind({
			kind: "genome-browser",
			label: "Genome Browser",
			detect: ({ text }) => text === "genomic-locus-track",
		});
		assert.strictEqual(inferArtifactKind("genomic-locus-track", []), "genome-browser");
		assert.strictEqual(artifactKindLabel("genome-browser"), "Genome Browser");
		assert.strictEqual(artifactKindClass("Genome Browser / Track"), "genome-browser-track");
	});

	it("uses details.artifact as a tool-independent publication contract", () => {
		assert.deepStrictEqual(
			readArtifactPublication({
				artifact: {
					title: "Result",
					kind: "network",
					files: [{ path: "network.json", label: "Network", kind: "file" }],
				},
			}),
			{
				title: "Result",
				kind: "network",
				files: [{ path: "network.json", label: "Network", kind: "file" }],
			},
		);
	});

	it("allows a tool to register its own status language", () => {
		registerToolPresenter("external-catalog", {
			statusLabel: (part) => (part.details?.loaded === true ? "mounted" : "inspected"),
		});
		assert.strictEqual(
			toolStatusLabel({
				kind: "tool",
				id: "external",
				tool: "external-catalog",
				status: "done",
				details: { loaded: true },
			}),
			"mounted",
		);
	});
});
