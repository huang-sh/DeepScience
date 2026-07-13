import assert from "node:assert";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createBasicTools } from "../src/tools/basic.ts";
import { createProvenance, withProvenance } from "../src/tools/provenance.ts";

describe("basic science tools", () => {
	let directory = "";
	let resourceDirectory = "";
	let outsideDirectory = "";

	before(async () => {
		directory = await mkdtemp(join(tmpdir(), "deepscience-tools-"));
		resourceDirectory = await mkdtemp(join(tmpdir(), "deepscience-resources-"));
		outsideDirectory = await mkdtemp(join(tmpdir(), "deepscience-outside-"));
		await mkdir(join(directory, "nested"));
		await mkdir(join(resourceDirectory, "references"));
		await writeFile(join(directory, "nested", "result.txt"), "alpha\nneedle\nomega\n");
		await writeFile(join(directory, "ignored.md"), "needle\n");
		await writeFile(join(resourceDirectory, "references", "schema.md"), "resource-schema\n");
		await writeFile(join(outsideDirectory, "secret.md"), "outside-resource\n");
		await symlink(outsideDirectory, join(resourceDirectory, "escaped"));
	});

	after(async () => {
		await Promise.all(
			[directory, resourceDirectory, outsideDirectory].map((path) => rm(path, { recursive: true, force: true })),
		);
	});

	it("honors multi-level glob patterns without invoking a shell", async () => {
		const globTool = createBasicTools({ directory }).find((tool) => tool.name === "glob");
		assert.ok(globTool);
		const result = await globTool.execute("glob-call", { pattern: "**/*.txt", path: directory });
		assert.deepStrictEqual(result.details, { count: 1 });
		assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /nested\/result\.txt/);
	});

	it("searches with argument-safe ripgrep invocation", async () => {
		const grepTool = createBasicTools({ directory }).find((tool) => tool.name === "grep");
		assert.ok(grepTool);
		const result = await grepTool.execute("grep-call", {
			pattern: "needle",
			path: directory,
			include: "*.txt",
		});
		const output = result.content[0]?.type === "text" ? result.content[0].text : "";
		assert.match(output, /nested\/result\.txt:2:needle/);
		assert.doesNotMatch(output, /ignored\.md/);
	});

	it("searches an exact file path instead of treating it as a working directory", async () => {
		const grepTool = createBasicTools({ directory }).find((tool) => tool.name === "grep");
		assert.ok(grepTool);
		const result = await grepTool.execute("grep-file-call", {
			pattern: "needle",
			path: "nested/result.txt",
		});
		assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /result\.txt:2:needle/);
	});

	it("runs bash from the session workspace root by default", async () => {
		const bashTool = createBasicTools({ directory }).find((tool) => tool.name === "bash");
		assert.ok(bashTool);
		const result = await bashTool.execute("bash-root-call", { command: "pwd" });
		assert.deepStrictEqual(result.details, { exitCode: 0 });
		assert.strictEqual(result.content[0]?.type === "text" ? result.content[0].text.trim() : "", directory);
	});

	it("injects stable Session, Project, and Resource roots into bash", async () => {
		const bashTool = createBasicTools({
			directory,
			projectDirectory: outsideDirectory,
			resourceDirectory,
		}).find((tool) => tool.name === "bash");
		assert.ok(bashTool);
		const result = await bashTool.execute("bash-roots-call", {
			command:
				'printf \'%s\\n%s\\n%s\\n\' "$DEEPSCIENCE_SESSION_WORKSPACE" "$DEEPSCIENCE_PROJECT_ROOT" "$DEEPSCIENCE_RESOURCE_ROOT"',
		});
		assert.deepStrictEqual((result.content[0]?.type === "text" ? result.content[0].text : "").trim().split("\n"), [
			directory,
			outsideDirectory,
			resourceDirectory,
		]);
	});

	it("binds file tools to the session workspace", async () => {
		const tools = createBasicTools({ directory });
		const writeTool = tools.find((tool) => tool.name === "write");
		const readTool = tools.find((tool) => tool.name === "read");
		assert.ok(writeTool);
		assert.ok(readTool);
		await writeTool.execute("write-call", { path: "result.md", content: "workspace-bound" });
		const result = await readTool.execute("read-call", { path: "result.md" });
		assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /workspace-bound/);
		await assert.rejects(
			() => readTool.execute("escape-call", { path: "../outside.txt" }),
			/escapes session workspace/,
		);
	});

	it("publishes curated artifacts only with existing Session workspace files", async () => {
		const artifactTool = createBasicTools({ directory }).find((tool) => tool.name === "artifact");
		assert.ok(artifactTool);
		const result = await artifactTool.execute("artifact-call", {
			title: "Key result",
			content: "## Result\n\nThe validated output is attached.",
			kind: "markdown",
			files: [{ path: "nested/result.txt", label: "Validated output" }],
		});
		assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /nested\/result\.txt/);
		assert.deepStrictEqual(result.details, {
			artifact: {
				title: "Key result",
				kind: "markdown",
				files: [{ path: "nested/result.txt", label: "Validated output", kind: "file" }],
			},
		});
		await assert.rejects(
			() =>
				artifactTool.execute("missing-artifact", {
					title: "Missing",
					files: [{ path: "missing.csv" }],
				}),
			/No such file|ENOENT/,
		);
	});

	it("does not expose sibling session workspaces through project source paths", async () => {
		const workspace = await mkdtemp(join(tmpdir(), "deepscience-session-workspace-"));
		const tools = createBasicTools({ directory: workspace, projectDirectory: directory });
		const readTool = tools.find((tool) => tool.name === "read");
		assert.ok(readTool);
		await assert.rejects(
			() => readTool.execute("read-other-session", { path: "project/.deepscience/workspaces/other/result.md" }),
			/Other session workspaces are not available/,
		);
		await rm(workspace, { recursive: true, force: true });
	});

	it("exposes only the configured Resource root through read-only paths", async () => {
		const tools = createBasicTools({ directory, resourceDirectory });
		const readTool = tools.find((tool) => tool.name === "read");
		const writeTool = tools.find((tool) => tool.name === "write");
		assert.ok(readTool);
		assert.ok(writeTool);

		const alias = await readTool.execute("read-resource-alias", {
			path: "resource/references/schema.md",
		});
		assert.match(alias.content[0]?.type === "text" ? alias.content[0].text : "", /resource-schema/);

		const absolute = await readTool.execute("read-resource-absolute", {
			path: join(resourceDirectory, "references", "schema.md"),
		});
		assert.match(absolute.content[0]?.type === "text" ? absolute.content[0].text : "", /resource-schema/);

		await assert.rejects(
			() => writeTool.execute("write-resource", { path: "resource/generated.md", content: "forbidden" }),
			/Resource packages are read-only/,
		);
		await assert.rejects(
			() => readTool.execute("read-resource-symlink", { path: "resource/escaped/secret.md" }),
			/escapes session workspace through a symlink/,
		);
	});
});

describe("science provenance", () => {
	it("preserves details while enforcing generated session metadata", () => {
		const provenance = createProvenance("session-1", "read");
		const details = withProvenance({ source: "fixture", provenance: { sessionId: "spoofed" } }, provenance);
		assert.strictEqual(details.source, "fixture");
		assert.deepStrictEqual(details.provenance, provenance);
	});
});
