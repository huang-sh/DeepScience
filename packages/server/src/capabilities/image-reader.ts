import { createReadImageTool } from "../read-image-tool.ts";
import { createToolExtension } from "./tool-extension.ts";
import type { DeepScienceCapability } from "./types.ts";

export const IMAGE_READER_CAPABILITY_ID = "image-reader";

export const imageReaderCapability: DeepScienceCapability = {
	id: IMAGE_READER_CAPABILITY_ID,
	async create(context) {
		if (!context.readImage) return undefined;
		return {
			extension: createToolExtension([createReadImageTool(context.readImage)]),
			appendSystemPrompt: `## Session Image Reading

The read_image tool gives this Agent access to the configured Vision Model without changing the main model. Uploaded images are stored below the Session Workspace's upload/ directory. Call it when the user asks about an attached or earlier Session image and you cannot directly inspect that image, or when a prior visual interpretation needs to be checked again. Use image_ref="latest" (or omit it) for the newest image; use its upload/<filename> path or exact image Part ID when distinguishing multiple images.

An "image omitted: model does not support images" transcript placeholder means only that the current text model cannot receive the raw bytes. It is not evidence that an earlier Vision Model answer was fabricated. In that situation, call read_image instead of guessing or retracting an earlier observation. Ask a focused question and treat the returned text as a new, provenance-bearing visual observation. Do not claim details beyond that observation.`,
		};
	},
};
