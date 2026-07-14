import assert from "node:assert";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	MAX_PROMPT_IMAGES,
	normalizePromptImages,
	PromptImageValidationError,
	storePromptImages,
} from "../src/prompt-images.ts";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64");

describe("prompt image validation", () => {
	it("accepts bounded image content for Pi", () => {
		assert.deepStrictEqual(normalizePromptImages([{ data: png, mimeType: "image/png", name: "plot.png" }]), [
			{ type: "image", data: png, mimeType: "image/png", name: "plot.png" },
		]);
	});

	it("stores pasted and selected images below the Session upload directory", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "ds-prompt-upload-"));
		const images = normalizePromptImages([
			{ data: png, mimeType: "image/png", name: "../plot.png" },
			{ data: png, mimeType: "image/png", name: "../plot.png" },
		]);
		const stored = await storePromptImages(workspace, images);
		assert.deepStrictEqual(
			stored.map((image) => image.path),
			["upload/plot.png", "upload/plot-2.png"],
		);
		assert.ok(existsSync(join(workspace, "upload")));
		assert.deepStrictEqual(readFileSync(join(workspace, stored[0].path)), Buffer.from(png, "base64"));
	});

	it("rejects malformed, mismatched, and excessive images", () => {
		assert.throws(
			() => normalizePromptImages([{ data: "not base64", mimeType: "image/png" }]),
			PromptImageValidationError,
		);
		assert.throws(
			() => normalizePromptImages([{ data: Buffer.from("GIF89a").toString("base64"), mimeType: "image/png" }]),
			/content does not match/,
		);
		assert.throws(
			() =>
				normalizePromptImages(
					Array.from({ length: MAX_PROMPT_IMAGES + 1 }, () => ({ data: png, mimeType: "image/png" })),
				),
			/at most/,
		);
	});
});
