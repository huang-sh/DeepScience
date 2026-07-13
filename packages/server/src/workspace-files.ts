import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";

const DEFAULT_WORKSPACE_ROOT = process.cwd();
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const MAX_DIRECTORY_ENTRIES = 1000;

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
};

const TEXT_MIME_BY_EXTENSION: Record<string, string> = {
	".txt": "text/plain",
	".md": "text/markdown",
	".markdown": "text/markdown",
	".pdb": "chemical/x-pdb",
	".cif": "chemical/x-cif",
	".mmcif": "chemical/x-mmcif",
	".mol2": "chemical/x-mol2",
	".html": "text/html",
	".htm": "text/html",
	".json": "application/json",
	".csv": "text/csv",
	".tsv": "text/tab-separated-values",
	".py": "text/x-python",
	".r": "text/plain",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".cjs": "text/javascript",
	".ts": "text/typescript",
	".tsx": "text/typescript",
	".jsx": "text/javascript",
	".sh": "text/x-shellscript",
	".bash": "text/x-shellscript",
	".zsh": "text/x-shellscript",
	".fish": "text/x-shellscript",
	".yaml": "application/yaml",
	".yml": "application/yaml",
	".toml": "application/toml",
	".xml": "application/xml",
	".css": "text/css",
	".sql": "application/sql",
};

export interface WorkspaceFileEntry {
	name: string;
	path: string;
	type: "directory" | "file";
	size: number;
	modifiedAt: number;
}

export interface WorkspaceFileList {
	workspace: string;
	path: string;
	parentPath: string;
	entries: WorkspaceFileEntry[];
	truncated: boolean;
}

export interface WorkspaceFilePreview {
	name: string;
	path: string;
	previewType: "image" | "text" | "unsupported";
	mimeType: string;
	size: number;
	content: string;
}

export class WorkspacePathError extends Error {}

function isWithinRoot(target: string, root: string): boolean {
	return target === root || target.startsWith(root + sep);
}

function toWorkspacePath(target: string, root: string): string {
	return relative(root, target).split(sep).join("/");
}

async function resolveWorkspacePath(
	requestedPath: string,
	root: string,
	expected: "directory" | "file",
): Promise<{ target: string; root: string }> {
	if (typeof requestedPath !== "string" || requestedPath.includes("\0") || requestedPath.includes("~")) {
		throw new WorkspacePathError("Invalid workspace path");
	}

	const rootReal = await realpath(resolve(root));
	const targetCandidate = resolve(rootReal, requestedPath || ".");
	if (!isWithinRoot(targetCandidate, rootReal)) {
		throw new WorkspacePathError("Path escapes workspace root");
	}

	let target: string;
	try {
		target = await realpath(targetCandidate);
	} catch {
		throw new WorkspacePathError("Workspace path not found");
	}
	if (!isWithinRoot(target, rootReal)) {
		throw new WorkspacePathError("Path escapes workspace root");
	}

	const metadata = await stat(target);
	if (expected === "directory" && !metadata.isDirectory()) {
		throw new WorkspacePathError("Workspace path is not a directory");
	}
	if (expected === "file" && !metadata.isFile()) {
		throw new WorkspacePathError("Workspace path is not a file");
	}
	return { target, root: rootReal };
}

export async function listWorkspaceFiles(
	requestedPath = "",
	root = DEFAULT_WORKSPACE_ROOT,
): Promise<WorkspaceFileList> {
	const resolved = await resolveWorkspacePath(requestedPath, root, "directory");
	const directoryEntries = await readdir(resolved.target, { withFileTypes: true });
	const hiddenAtRoot =
		resolved.target === resolved.root ? new Set([".deepscience", ".git", "node_modules"]) : new Set();
	const visibleEntries = directoryEntries.filter(
		(entry) => !hiddenAtRoot.has(entry.name) && entry.name !== ".git" && entry.name !== "node_modules",
	);
	const entries: WorkspaceFileEntry[] = [];

	for (const entry of visibleEntries.slice(0, MAX_DIRECTORY_ENTRIES)) {
		const target = resolve(resolved.target, entry.name);
		const targetMetadata = await lstat(target).catch(() => undefined);
		if (!targetMetadata || targetMetadata.isSymbolicLink()) continue;
		if (!targetMetadata.isDirectory() && !targetMetadata.isFile()) continue;
		entries.push({
			name: entry.name,
			path: toWorkspacePath(target, resolved.root),
			type: targetMetadata.isDirectory() ? "directory" : "file",
			size: targetMetadata.isFile() ? targetMetadata.size : 0,
			modifiedAt: targetMetadata.mtimeMs,
		});
	}

	entries.sort((left, right) => {
		if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
		return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
	});

	const path = toWorkspacePath(resolved.target, resolved.root);
	const parentTarget = dirname(resolved.target);
	return {
		workspace: resolved.root,
		path,
		parentPath: resolved.target === resolved.root ? "" : toWorkspacePath(parentTarget, resolved.root),
		entries,
		truncated: visibleEntries.length > MAX_DIRECTORY_ENTRIES,
	};
}

export async function previewWorkspaceFile(
	requestedPath: string,
	root = DEFAULT_WORKSPACE_ROOT,
): Promise<WorkspaceFilePreview> {
	const resolved = await resolveWorkspacePath(requestedPath, root, "file");
	const metadata = await stat(resolved.target);
	const path = toWorkspacePath(resolved.target, resolved.root);
	const extension = extname(resolved.target).toLowerCase();
	const imageMime = IMAGE_MIME_BY_EXTENSION[extension];
	if (imageMime) {
		return {
			name: basename(resolved.target),
			path,
			previewType: "image",
			mimeType: imageMime,
			size: metadata.size,
			content: "",
		};
	}

	const textMime = TEXT_MIME_BY_EXTENSION[extension];
	if (textMime && metadata.size <= MAX_PREVIEW_BYTES) {
		return {
			name: basename(resolved.target),
			path,
			previewType: "text",
			mimeType: textMime,
			size: metadata.size,
			content: await readFile(resolved.target, "utf8"),
		};
	}

	return {
		name: basename(resolved.target),
		path,
		previewType: "unsupported",
		mimeType: "application/octet-stream",
		size: metadata.size,
		content:
			metadata.size > MAX_PREVIEW_BYTES
				? "File is too large to preview."
				: "Preview is not available for this file type.",
	};
}
