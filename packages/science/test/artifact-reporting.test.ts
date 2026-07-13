import assert from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildSystemPrompt } from "../src/agents/registry.ts";

const execFileAsync = promisify(execFile);
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const biologicalKnowledge = join(packageRoot, "resources", "skills", "biological-knowledge");

describe("artifact report gate", () => {
	it("is present in the Biology runtime prompt and Resource workflow", async () => {
		const [prompt, skill] = await Promise.all([
			buildSystemPrompt("biology"),
			readFile(join(biologicalKnowledge, "SKILL.md"), "utf8"),
		]);

		assert.match(prompt, /### Artifact report gate/);
		assert.match(prompt, /sole authority for members, identifiers, annotations, releases, and counts/);
		assert.match(prompt, /generate a deterministic `.tsv`, `.json`, or `.md`\s+artifact/);
		assert.match(skill, /every reported identifier is present in a documented artifact field/);
		assert.match(skill, /complete membership lists remain in deterministic\s+artifacts/);
	});

	it("marks a KEGG snapshot pathway ID unavailable instead of inferring one", async () => {
		const temporaryDirectory = await mkdtemp(join(tmpdir(), "deepscience-kegg-contract-"));
		const output = join(temporaryDirectory, "kegg-snapshot.json");
		const script = join(
			biologicalKnowledge,
			"functional-signatures",
			"pathway",
			"kegg",
			"biomarker-kegg",
			"scripts",
			"query_kegg.py",
		);

		try {
			await execFileAsync("python3", [script, "snapshot", "cholesterol metabolism", "--output", output]);
			const result = JSON.parse(await readFile(output, "utf8"));
			assert.strictEqual(result.count, 1);
			assert.strictEqual(result.matches[0].pathwayId, null);
			assert.strictEqual(result.matches[0].geneCount, result.matches[0].genes.length);
			assert.match(result.schema.matches, /pathwayId: null/);
		} finally {
			await rm(temporaryDirectory, { recursive: true, force: true });
		}
	});
});
