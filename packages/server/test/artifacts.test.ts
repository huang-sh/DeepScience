import assert from "node:assert";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, it } from "node:test";
import { Hono } from "hono";
import { resolveArtifactStream, serveArtifactContent } from "../src/artifacts.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "deepscience-artifact-"));
	roots.push(root);
	return root;
}

describe("workspace artifact resolver", () => {
	it("serves relative and absolute image paths inside the workspace", async () => {
		const root = await tempRoot();
		const image = join(root, "plot.png");
		await writeFile(image, Buffer.from("png"));

		for (const path of ["plot.png", image]) {
			const result = await resolveArtifactStream(path, root);
			assert.strictEqual(result.ok, true);
			if (result.ok) {
				assert.strictEqual(result.mimeType, "image/png");
				await result.stream.cancel();
			}
		}
	});

	it("rejects traversal and symlink escape", async () => {
		const parent = await tempRoot();
		const root = join(parent, "workspace");
		const outside = join(parent, "outside.txt");
		await mkdir(root);
		await writeFile(outside, "secret");
		await symlink(outside, join(root, "escape.txt"));

		for (const path of ["../outside.txt", "escape.txt", outside]) {
			const result = await resolveArtifactStream(path, root);
			assert.strictEqual(result.ok, false);
			if (!result.ok) assert.strictEqual(result.status, 403);
		}
	});

	it("rejects executable document formats", async () => {
		const root = await tempRoot();
		await writeFile(join(root, "unsafe.svg"), "<svg/>");
		await writeFile(join(root, "unsafe.html"), "<script>alert(1)</script>");

		for (const path of ["unsafe.svg", "unsafe.html"]) {
			const result = await resolveArtifactStream(path, root);
			assert.strictEqual(result.ok, false);
			if (!result.ok) assert.strictEqual(result.status, 415);
		}
	});

	it("serves the registered response with defensive headers", async () => {
		const root = await mkdtemp(join(process.cwd(), ".deepscience-artifact-test-"));
		roots.push(root);
		const file = join(root, "result.json");
		await writeFile(file, '{"ok":true}');
		const app = new Hono();
		app.get("/api/artifacts/content", serveArtifactContent);

		const path = relative(process.cwd(), file);
		const response = await app.request(`/api/artifacts/content?path=${encodeURIComponent(path)}`);
		assert.strictEqual(response.status, 200);
		assert.strictEqual(response.headers.get("content-type"), "application/json");
		assert.strictEqual(response.headers.get("x-content-type-options"), "nosniff");
		assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
		assert.strictEqual(await response.text(), '{"ok":true}');
	});
});
