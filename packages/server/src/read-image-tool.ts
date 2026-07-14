import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { ReadImageRequest, ReadImageResult } from "./capabilities/types.ts";

const readImageSchema = Type.Object({
	image_ref: Type.Optional(
		Type.String({
			description:
				'Stable image Part ID from the Session message history. Omit it or use "latest" for the newest image.',
		}),
	),
	question: Type.String({
		minLength: 1,
		description:
			"A focused request for what the Vision Model should inspect, extract, compare, verify, or transcribe from the image.",
	}),
});

export function createReadImageTool(
	readImage: (request: ReadImageRequest, signal?: AbortSignal) => Promise<ReadImageResult>,
): AgentTool<typeof readImageSchema> {
	return {
		name: "read_image",
		label: "Read Image",
		description:
			"Read a Session image with the configured Vision Model and return a grounded textual observation to the current Agent. Use this when the current text model cannot inspect image bytes, when the user asks a follow-up about an earlier image, or when a visual claim needs verification. Omit image_ref to inspect the latest image.",
		parameters: readImageSchema,
		async execute(_id, params, signal) {
			const question = params.question.trim();
			if (!question) throw new Error("read_image requires a non-empty question");
			const result = await readImage({ imageRef: params.image_ref?.trim() || "latest", question }, signal);
			const text = result.path ? `[Image source: ${result.path}]\n\n${result.text}` : result.text;
			return {
				content: [{ type: "text" as const, text }],
				details: {
					imageRef: result.imageRef,
					...(result.path ? { path: result.path } : {}),
					mimeType: result.mimeType,
					sha256: result.sha256,
					model: result.model,
					groundedByVisionModel: true,
				},
			};
		},
	};
}
