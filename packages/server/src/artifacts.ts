/* ================================================================
   DeepScience server — read-only workspace artifact endpoint

   Serves files created by agent tools (plots, code, data) from the
   current working directory only. Strictly rejects traversal, symlinks
   that escape the workspace, directories, oversized files, and
   disallowed file types.
   ================================================================ */

import { createReadStream, realpath as realpathCb } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, isAbsolute, resolve, sep } from "node:path";
import type { Context } from "hono";

const WORKSPACE_ROOT = process.cwd();
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MiB

const MIME_BY_EXTENSION: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".txt": "text/plain",
	".md": "text/plain",
	".markdown": "text/plain",
	".json": "application/json",
	".csv": "text/csv",
	".tsv": "text/tab-separated-values",
	".bed": "text/plain",
	".fa": "text/plain",
	".fasta": "text/plain",
	".gmt": "text/plain",
	".py": "text/plain",
	".js": "text/plain",
	".mjs": "text/plain",
	".cjs": "text/plain",
	".ts": "text/plain",
	".tsx": "text/plain",
	".jsx": "text/plain",
	".r": "text/plain",
	".sh": "text/plain",
	".bash": "text/plain",
	".zsh": "text/plain",
	".fish": "text/plain",
	".yaml": "text/plain",
	".yml": "text/plain",
	".toml": "text/plain",
	".xml": "text/plain",
	".css": "text/plain",
	".sql": "text/plain",
};

function safeFilename(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getMimeType(filePath: string): string | undefined {
	const ext = extname(filePath).toLowerCase();
	if (!ext) return "text/plain";
	return MIME_BY_EXTENSION[ext];
}

type ArtifactErrorStatus = 400 | 403 | 404 | 413 | 415;

/**
 * Resolve and validate an artifact path relative to the workspace root.
 *
 * Returns a stream handle, file descriptor, and metadata on success, or an
 * error description on failure. The caller is responsible for closing the
 * returned handle/fd.
 */
export async function resolveArtifactStream(
	requestedPath: string,
	root: string = WORKSPACE_ROOT,
	maxFileSize: number = MAX_FILE_SIZE,
): Promise<
	| { ok: true; stream: ReadableStream; size: number; mimeType: string; filename: string }
	| { ok: false; status: ArtifactErrorStatus; error: string }
> {
	if (!requestedPath || typeof requestedPath !== "string") {
		return { ok: false, status: 400, error: "Missing path parameter" };
	}

	if (requestedPath.includes("~")) {
		return { ok: false, status: 400, error: "Path contains traversal characters" };
	}

	const joined = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(root, requestedPath);

	let realPath: string;
	try {
		realPath = await realpath(joined);
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOENT" || code === "ENOTDIR") {
			return { ok: false, status: 404, error: "File not found" };
		}
		return { ok: false, status: 400, error: "Invalid path" };
	}

	const rootReal = await realpath(resolve(root));
	if (!realPath.startsWith(rootReal + sep) && realPath !== rootReal) {
		return { ok: false, status: 403, error: "Path escapes workspace root" };
	}

	let stats: Awaited<ReturnType<typeof stat>>;
	try {
		stats = await stat(realPath);
	} catch {
		return { ok: false, status: 404, error: "File not found" };
	}

	if (!stats.isFile()) {
		return { ok: false, status: 400, error: "Not a regular file" };
	}

	if (stats.size > maxFileSize) {
		return { ok: false, status: 413, error: `File exceeds ${maxFileSize} byte limit` };
	}

	const mimeType = getMimeType(realPath);
	if (!mimeType) {
		return { ok: false, status: 415, error: "Unsupported file type" };
	}

	const stream = createReadStream(realPath);

	// Wrap the Node stream in a Web ReadableStream so Hono can stream it.
	const webStream = new ReadableStream({
		start(controller) {
			stream.on("data", (chunk: string | Buffer) => {
				controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
			});
			stream.on("end", () => controller.close());
			stream.on("error", (err) => controller.error(err));
		},
		cancel() {
			stream.destroy();
		},
	});

	return {
		ok: true,
		stream: webStream,
		size: stats.size,
		mimeType,
		filename: safeFilename(basename(realPath)),
	};
}

function realpath(path: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		realpathCb(path, (err, resolved) => {
			if (err) reject(err);
			else resolve(resolved);
		});
	});
}

/**
 * Hono handler for GET /api/artifacts/content?path=...
 */
export async function serveArtifactContentFromRoot(c: Context, root: string): Promise<Response> {
	const requested = c.req.query("path") ?? "";
	const result = await resolveArtifactStream(requested, root);

	if (!result.ok) {
		return c.json({ error: result.error }, result.status);
	}

	c.header("Content-Type", result.mimeType);
	c.header("Content-Length", String(result.size));
	c.header("X-Content-Type-Options", "nosniff");
	c.header("Content-Disposition", `inline; filename="${result.filename}"`);
	c.header("Cache-Control", "private, no-store");
	c.header("Content-Security-Policy", "default-src 'none'; sandbox");

	return c.body(result.stream);
}

export async function serveArtifactContent(c: Context): Promise<Response> {
	return serveArtifactContentFromRoot(c, WORKSPACE_ROOT);
}
