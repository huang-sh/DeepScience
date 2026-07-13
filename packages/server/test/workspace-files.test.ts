import assert from "node:assert";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { listWorkspaceFiles, previewWorkspaceFile, WorkspacePathError } from "../src/workspace-files.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "deepscience-workspace-"));
	roots.push(root);
	return root;
}

describe("workspace file browser", () => {
	it("lists directories before files and returns navigable paths", async () => {
		const root = await tempRoot();
		await mkdir(join(root, "results"));
		await mkdir(join(root, ".deepscience"));
		await writeFile(join(root, ".deepscience", "workspace.json"), "{}");
		await writeFile(join(root, "z.txt"), "z");
		await writeFile(join(root, "a.txt"), "a");

		const listing = await listWorkspaceFiles("", root);
		assert.strictEqual(listing.workspace, root);
		assert.strictEqual(listing.path, "");
		assert.deepStrictEqual(
			listing.entries.map((entry) => [entry.type, entry.path]),
			[
				["directory", "results"],
				["file", "a.txt"],
				["file", "z.txt"],
			],
		);

		const nested = await listWorkspaceFiles("results", root);
		assert.strictEqual(nested.path, "results");
		assert.strictEqual(nested.parentPath, "");
	});

	it("previews supported text and image files", async () => {
		const root = await tempRoot();
		await writeFile(join(root, "report.md"), "# Result");
		await writeFile(join(root, "report.html"), "<h1>Result</h1>");
		await writeFile(join(root, "plot.png"), Buffer.from("png"));

		const text = await previewWorkspaceFile("report.md", root);
		assert.strictEqual(text.previewType, "text");
		assert.strictEqual(text.content, "# Result");
		const html = await previewWorkspaceFile("report.html", root);
		assert.strictEqual(html.previewType, "text");
		assert.strictEqual(html.mimeType, "text/html");
		assert.strictEqual(html.content, "<h1>Result</h1>");

		const image = await previewWorkspaceFile("plot.png", root);
		assert.strictEqual(image.previewType, "image");
		assert.strictEqual(image.mimeType, "image/png");
	});

	it("rejects traversal and skips symlinks", async () => {
		const parent = await tempRoot();
		const root = join(parent, "workspace");
		await mkdir(root);
		await writeFile(join(parent, "outside.txt"), "secret");
		await symlink(join(parent, "outside.txt"), join(root, "escape.txt"));

		await assert.rejects(() => previewWorkspaceFile("../outside.txt", root), WorkspacePathError);
		const listing = await listWorkspaceFiles("", root);
		assert.deepStrictEqual(listing.entries, []);
	});
});
