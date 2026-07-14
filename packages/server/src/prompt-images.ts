import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";

export const MAX_PROMPT_IMAGES = 4;
export const MAX_PROMPT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROMPT_IMAGE_TOTAL_BYTES = 12 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface PromptImage extends ImageContent {
	name?: string;
}

export interface StoredPromptImage extends PromptImage {
	name: string;
	/** POSIX-style path relative to the Session Workspace. */
	path: string;
}

export class PromptImageValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PromptImageValidationError";
	}
}

export function normalizePromptImages(input: unknown): PromptImage[] {
	if (input === undefined) return [];
	if (!Array.isArray(input)) throw new PromptImageValidationError("images must be an array");
	if (input.length > MAX_PROMPT_IMAGES) {
		throw new PromptImageValidationError(`A prompt can contain at most ${MAX_PROMPT_IMAGES} images`);
	}

	let totalBytes = 0;
	return input.map((candidate, index) => {
		if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
			throw new PromptImageValidationError(`Image ${index + 1} is invalid`);
		}
		const value = candidate as { data?: unknown; mimeType?: unknown; name?: unknown };
		if (typeof value.mimeType !== "string" || !SUPPORTED_IMAGE_TYPES.has(value.mimeType)) {
			throw new PromptImageValidationError(`Image ${index + 1} must be PNG, JPEG, WebP, or GIF`);
		}
		if (typeof value.data !== "string" || !value.data || !BASE64_PATTERN.test(value.data)) {
			throw new PromptImageValidationError(`Image ${index + 1} contains invalid base64 data`);
		}
		const bytes = Buffer.from(value.data, "base64");
		if (bytes.length === 0 || !matchesImageSignature(bytes, value.mimeType)) {
			throw new PromptImageValidationError(`Image ${index + 1} content does not match ${value.mimeType}`);
		}
		if (bytes.length > MAX_PROMPT_IMAGE_BYTES) {
			throw new PromptImageValidationError(`Image ${index + 1} exceeds the 5 MB limit`);
		}
		totalBytes += bytes.length;
		if (totalBytes > MAX_PROMPT_IMAGE_TOTAL_BYTES) {
			throw new PromptImageValidationError("Prompt images exceed the 12 MB combined limit");
		}
		return {
			type: "image",
			data: value.data,
			mimeType: value.mimeType,
			name: typeof value.name === "string" ? value.name : undefined,
		};
	});
}

export async function storePromptImages(
	workspaceDirectory: string,
	images: readonly PromptImage[],
): Promise<StoredPromptImage[]> {
	if (images.length === 0) return [];
	const uploadDirectory = join(workspaceDirectory, "upload");
	await mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
	const stored: StoredPromptImage[] = [];
	for (const image of images) {
		const bytes = Buffer.from(image.data, "base64");
		const requestedName = safeUploadName(image.name, image.mimeType);
		const extension = extname(requestedName);
		const stem = extension ? requestedName.slice(0, -extension.length) : requestedName;
		let writtenName = requestedName;
		for (let suffix = 1; ; suffix++) {
			try {
				await writeFile(join(uploadDirectory, writtenName), bytes, { flag: "wx", mode: 0o600 });
				break;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				writtenName = `${stem}-${suffix + 1}${extension}`;
			}
		}
		stored.push({ ...image, name: writtenName, path: `upload/${writtenName}` });
	}
	return stored;
}

function safeUploadName(name: string | undefined, mimeType: string): string {
	const fallback = `image.${extensionForMimeType(mimeType)}`;
	const normalized = (name ?? fallback)
		.normalize("NFKC")
		.replace(/[\\/\u0000-\u001f\u007f]+/g, "-")
		.replace(/^[.-]+/, "")
		.trim()
		.slice(0, 160);
	const candidate = normalized && normalized !== "." && normalized !== ".." ? normalized : fallback;
	return extname(candidate) ? candidate : `${candidate}.${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType: string): string {
	if (mimeType === "image/jpeg") return "jpg";
	return mimeType.slice("image/".length);
}

function matchesImageSignature(bytes: Buffer, mimeType: string): boolean {
	switch (mimeType) {
		case "image/png":
			return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		case "image/jpeg":
			return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
		case "image/gif": {
			const signature = bytes.subarray(0, 6).toString("ascii");
			return signature === "GIF87a" || signature === "GIF89a";
		}
		case "image/webp":
			return (
				bytes.length >= 12 &&
				bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
				bytes.subarray(8, 12).toString("ascii") === "WEBP"
			);
		default:
			return false;
	}
}
