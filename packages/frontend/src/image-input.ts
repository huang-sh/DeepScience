import type { PromptImage } from "./types";

export const MAX_COMPOSER_IMAGES = 4;
export const MAX_COMPOSER_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_COMPOSER_IMAGE_TOTAL_BYTES = 12 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface ComposerImage extends PromptImage {
	id: string;
	name: string;
	size: number;
}

export function clipboardImageFiles(event: ClipboardEvent): File[] {
	const itemFiles = Array.from(event.clipboardData?.items ?? [])
		.filter((item) => item.kind === "file" && item.type.startsWith("image/"))
		.map((item) => item.getAsFile())
		.filter((file): file is File => file !== null);
	const directFiles = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
	// Browsers commonly expose the same pasted image through both `items` and
	// `files`. Those entries may be separate File instances, so reference-based
	// Set deduplication does not work. Treat `files` as a compatibility fallback.
	return deduplicateFiles(itemFiles.length > 0 ? itemFiles : directFiles);
}

function deduplicateFiles(files: File[]): File[] {
	const seen = new Set<string>();
	return files.filter((file) => {
		const key = `${file.name}\u0000${file.type}\u0000${file.size}\u0000${file.lastModified}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export async function loadComposerImages(
	files: Iterable<File>,
	existing: ComposerImage[],
): Promise<{ images: ComposerImage[]; errors: string[] }> {
	const images: ComposerImage[] = [];
	const errors: string[] = [];
	let totalBytes = existing.reduce((total, image) => total + image.size, 0);
	for (const file of files) {
		if (existing.length + images.length >= MAX_COMPOSER_IMAGES) {
			errors.push(`You can attach up to ${MAX_COMPOSER_IMAGES} images.`);
			break;
		}
		if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
			errors.push(`${file.name || "Pasted image"} is not a supported PNG, JPEG, WebP, or GIF image.`);
			continue;
		}
		if (file.size <= 0 || file.size > MAX_COMPOSER_IMAGE_BYTES) {
			errors.push(`${file.name || "Pasted image"} must be smaller than 5 MB.`);
			continue;
		}
		if (totalBytes + file.size > MAX_COMPOSER_IMAGE_TOTAL_BYTES) {
			errors.push("Attached images must be 12 MB or less in total.");
			continue;
		}
		try {
			const dataUrl = await readAsDataUrl(file);
			const comma = dataUrl.indexOf(",");
			if (comma < 0) throw new Error("Invalid image data");
			images.push({
				id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
				name: file.name || `pasted-image.${extensionForMime(file.type)}`,
				size: file.size,
				mimeType: file.type,
				data: dataUrl.slice(comma + 1),
			});
			totalBytes += file.size;
		} catch {
			errors.push(`Could not read ${file.name || "the pasted image"}.`);
		}
	}
	return { images, errors: [...new Set(errors)] };
}

function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.readAsDataURL(file);
	});
}

function extensionForMime(mimeType: string): string {
	if (mimeType === "image/jpeg") return "jpg";
	return mimeType.slice("image/".length) || "png";
}
