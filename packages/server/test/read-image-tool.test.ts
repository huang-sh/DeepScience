import assert from "node:assert";
import { describe, it } from "node:test";
import { createReadImageTool } from "../src/read-image-tool.ts";

describe("read_image tool", () => {
	it("delegates a focused question and returns visual provenance", async () => {
		const calls: Array<{ imageRef?: string; question: string }> = [];
		const tool = createReadImageTool(async (request) => {
			calls.push(request);
			return {
				text: "The chart peaks at day 7.",
				imageRef: "part_image_1",
				path: "upload/chart.png",
				mimeType: "image/png",
				sha256: "abc123",
				model: { provider: "bigmodel", id: "glm-5v-turbo", name: "GLM-5V Turbo" },
			};
		});

		const result = await tool.execute("call-1", {
			image_ref: "part_image_1",
			question: " When does the chart peak? ",
		});

		assert.deepStrictEqual(calls, [{ imageRef: "part_image_1", question: "When does the chart peak?" }]);
		assert.deepStrictEqual(result.content, [
			{ type: "text", text: "[Image source: upload/chart.png]\n\nThe chart peaks at day 7." },
		]);
		assert.deepStrictEqual(result.details, {
			imageRef: "part_image_1",
			path: "upload/chart.png",
			mimeType: "image/png",
			sha256: "abc123",
			model: { provider: "bigmodel", id: "glm-5v-turbo", name: "GLM-5V Turbo" },
			groundedByVisionModel: true,
		});
	});

	it("uses the latest image when no exact reference is supplied", async () => {
		let imageRef: string | undefined;
		const tool = createReadImageTool(async (request) => {
			imageRef = request.imageRef;
			return {
				text: "Visible result",
				imageRef: "part_latest",
				mimeType: "image/jpeg",
				sha256: "def456",
				model: { provider: "provider", id: "vision", name: "Vision" },
			};
		});
		await tool.execute("call-2", { question: "Describe it" });
		assert.strictEqual(imageRef, "latest");
	});
});
