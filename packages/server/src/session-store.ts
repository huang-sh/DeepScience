import type { Dirent } from "node:fs";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export const CURRENT_RECORD_VERSION = 4;

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;
const MESSAGE_ID_RE = /^msg_[a-zA-Z0-9_-]+$/;
const PART_ID_RE = /^part_[a-zA-Z0-9_-]+$/;
const SNAPSHOT_ID_RE = /^snap_[a-zA-Z0-9_-]+$/;
const MAX_SESSION_ID_LEN = 128;
const MAX_MESSAGE_ID_LEN = 128;
const MAX_PART_ID_LEN = 128;
const MAX_SNAPSHOT_ID_LEN = 128;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;

export interface ModelRef {
	provider: string;
	id: string;
	name: string;
	reasoning?: boolean;
	thinkingLevels?: ThinkingLevel[];
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface SessionSummary {
	text: string;
	createdAt?: number;
	updatedAt?: number;
}

export interface RevertMeta {
	messageID: string;
	partID?: string;
	snapshotID?: string;
	createdAt: number;
}

export interface CompactionMeta {
	snapshotID: string;
	summary: string;
	retainedTurns: number;
	createdAt: number;
}

export interface SessionInfo {
	id: string;
	agentName: string;
	model: ModelRef;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	preview: string;
	/** Stable project identity shared by the main checkout and linked worktrees. */
	projectID?: string;
	/** Execution Workspace used by this session's tools and artifact APIs. */
	directory?: string;
	/** User-selected Workspace root; differs only when this session is explicitly bound to a sub-workspace. */
	projectDirectory?: string;
	/** Git worktree root, or the project directory for non-Git workspaces. */
	worktree?: string;
	workspaceKind?: "project" | "git-worktree";
	thinkingLevel?: ThinkingLevel;
	parentID?: string;
	forkedFrom?: { sessionID: string; messageID?: string };
	summary?: SessionSummary;
	revert?: RevertMeta;
	compaction?: CompactionMeta;
}

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
	id: string;
	content: string;
	status: TodoStatus;
	priority: TodoPriority;
	createdAt: number;
	updatedAt: number;
}

export interface Diff {
	id: string;
	file: string;
	before?: string;
	after?: string;
	patch?: string;
	additions: number;
	deletions: number;
	messageID?: string;
	createdAt: number;
}

export interface Snapshot {
	id: string;
	label?: string;
	createdAt: number;
	messages: AgentMessage[];
	info: SessionInfo;
	sidecar: SessionSidecar;
}

export interface DurableMessage {
	id: string;
	role: "user" | "assistant" | "tool";
	sessionID: string;
	createdAt: number;
	agent?: string;
	modelID?: string;
	providerID?: string;
	stopReason?: "stop" | "length" | "toolUse" | "error" | "aborted";
	errorMessage?: string;
}

export interface DurablePart {
	id: string;
	messageID: string;
	type: "text" | "thinking" | "tool";
	text?: string;
	phase?: "process" | "final";
	redacted?: boolean;
	signature?: string;
	tool?: string;
	callId?: string;
	state?: { status: "completed" | "error" };
	content?: unknown[];
	details?: unknown;
	output?: string;
	synthetic: boolean;
}

/**
 * Extensible sidecar envelope for session metadata that should survive restarts.
 * Phase 2 stores durable message/part metadata, todos, diffs, snapshots,
 * summary, compaction, and revert state here so the Pi transcript stays lossless.
 */
export interface SessionSidecar {
	messages?: Record<string, DurableMessage>;
	parts?: Record<string, DurablePart>;
	messageOrder?: string[];
	todos?: Todo[];
	diffs?: Diff[];
	snapshots?: Snapshot[];
	summary?: SessionSummary;
	capabilities?: Record<string, { loaded?: string[]; [key: string]: unknown }>;
	[key: string]: unknown;
}

export interface StoredSessionRecord {
	/** Schema version of this record. Migrations run on load. */
	version: number;
	/** Durable session metadata. */
	info: SessionInfo;
	/** Complete JSON-serializable Pi Agent transcript. */
	messages: AgentMessage[];
	/** Future-proof sidecar envelope. */
	sidecar: SessionSidecar;
}

export interface SessionStoreOptions {
	/** Workspace-local .deepscience directory. */
	rootDir: string;
}

/** Reject path-traversal or otherwise unsafe session identifiers. */
export function isValidSessionId(id: string): boolean {
	return typeof id === "string" && id.length > 0 && id.length <= MAX_SESSION_ID_LEN && SESSION_ID_RE.test(id);
}

/** Validate a durable message id. */
export function isValidMessageId(id: string): boolean {
	return typeof id === "string" && id.length > 0 && id.length <= MAX_MESSAGE_ID_LEN && MESSAGE_ID_RE.test(id);
}

/** Validate a durable part id. */
export function isValidPartId(id: string): boolean {
	return typeof id === "string" && id.length > 0 && id.length <= MAX_PART_ID_LEN && PART_ID_RE.test(id);
}

/** Validate a snapshot id. */
export function isValidSnapshotId(id: string): boolean {
	return typeof id === "string" && id.length > 0 && id.length <= MAX_SNAPSHOT_ID_LEN && SNAPSHOT_ID_RE.test(id);
}

/**
 * Crash-resilient, versioned file storage for session records.
 *
 * Guarantees:
 * - Only safe, generated session IDs are accepted.
 * - Session directories never escape the configured root.
 * - Symlinked session directories/files are ignored/not followed.
 * - Writes are atomic (temp file + rename) and JSON is never partially visible.
 * - Overlapping writes for one session are serialized; newer state always wins.
 * - A corrupt/incompatible record is surfaced as a warning and skipped during list.
 */
export class SessionStore {
	private readonly rootDir: string;
	private readonly sessionsDir: string;
	private readonly writeQueues = new Map<string, Promise<void>>();

	constructor(options: SessionStoreOptions) {
		this.rootDir = options.rootDir;
		this.sessionsDir = join(this.rootDir, "sessions");
	}

	get root(): string {
		return this.rootDir;
	}

	private validatedSessionDir(id: string): string {
		if (!isValidSessionId(id)) {
			throw new Error(`Unsafe session id: ${id}`);
		}
		const dir = resolve(join(this.sessionsDir, id));
		const resolvedRoot = resolve(this.sessionsDir);
		// Ensure the resolved path stays inside the sessions directory.
		if (dir !== resolvedRoot && !dir.startsWith(resolvedRoot + sep)) {
			throw new Error(`Session path escapes root: ${id}`);
		}
		return dir;
	}

	private recordPath(id: string): string {
		return join(this.validatedSessionDir(id), "session.json");
	}

	private async assertNotSymlink(p: string): Promise<void> {
		try {
			const s = await lstat(p);
			if (s.isSymbolicLink()) {
				throw new Error(`Symlink not followed: ${p}`);
			}
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === "ENOENT") return;
			throw err;
		}
	}

	private async ensureSessionsDir(): Promise<void> {
		await this.assertNotSymlink(this.sessionsDir);
		await mkdir(this.sessionsDir, { recursive: true, mode: 0o700 });
		await this.assertNotSymlink(this.sessionsDir);
	}

	/** Persist a brand-new session record. */
	async create(record: StoredSessionRecord): Promise<void> {
		const id = record.info.id;
		const dir = this.validatedSessionDir(id);
		await this.ensureSessionsDir();
		await mkdir(dir, { recursive: true, mode: 0o700 });
		await this.write(id, record);
	}

	/**
	 * Serialize and atomically write a session record.
	 *
	 * Overlapping writes for the same session are queued; when the current write
	 * finishes, the next queued write carries the latest state, so an older
	 * snapshot can never overwrite a newer one.
	 */
	async write(id: string, record: StoredSessionRecord): Promise<void> {
		this.validatedSessionDir(id); // validate early
		if (record.version !== CURRENT_RECORD_VERSION) {
			throw new Error(`unsupported record version ${record.version}`);
		}
		const serialized = `${JSON.stringify(record, null, 2)}\n`;
		if (Buffer.byteLength(serialized) > MAX_RECORD_BYTES) {
			throw new Error(`Session record exceeds ${MAX_RECORD_BYTES} bytes`);
		}
		const previous = this.writeQueues.get(id);
		const current = (async () => {
			try {
				if (previous) await previous;
			} catch {
				// Previous failures must not block the latest state from landing.
			}
			await this.atomicWrite(id, serialized);
		})();
		this.writeQueues.set(id, current);
		try {
			await current;
		} finally {
			if (this.writeQueues.get(id) === current) {
				this.writeQueues.delete(id);
			}
		}
	}

	private async atomicWrite(id: string, serialized: string): Promise<void> {
		const dir = this.validatedSessionDir(id);
		await this.ensureSessionsDir();
		await mkdir(dir, { recursive: true, mode: 0o700 });
		const target = join(dir, "session.json");
		// Use pid + monotonic counter to avoid collisions between concurrent writers.
		const temp = join(dir, `session.json.tmp-${process.pid}-${Date.now()}-${writeCounter++}`);
		await this.assertNotSymlink(dir);
		await this.assertNotSymlink(target);
		try {
			await writeFile(temp, serialized, { encoding: "utf-8", mode: 0o600 });
			await rename(temp, target);
		} finally {
			await rm(temp, { force: true }).catch(() => undefined);
		}
	}

	/** Load a current-version session record from disk. */
	async load(id: string): Promise<StoredSessionRecord | undefined> {
		const dir = this.validatedSessionDir(id);
		const target = this.recordPath(id);
		await this.assertNotSymlink(this.sessionsDir);
		await this.assertNotSymlink(dir);
		await this.assertNotSymlink(target);
		let data: string;
		try {
			data = await readFile(target, "utf-8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw err;
		}
		if (Buffer.byteLength(data) > MAX_RECORD_BYTES) {
			throw new Error(`Session record exceeds ${MAX_RECORD_BYTES} bytes`);
		}
		const parsed = JSON.parse(data) as unknown;
		const record = validateRecord(parsed);
		if (record.info.id !== id) throw new Error("session id does not match its directory");
		return record;
	}

	/** Recursively and safely remove a session's durable record. */
	async delete(id: string): Promise<boolean> {
		this.validatedSessionDir(id);
		const dir = this.validatedSessionDir(id);
		await this.assertNotSymlink(dir);
		try {
			await rm(dir, { recursive: true, force: true });
			return true;
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
			throw err;
		}
	}

	/** List metadata for every loadable persisted session. */
	async list(): Promise<SessionInfo[]> {
		let entries: Dirent[];
		try {
			entries = await readdir(this.sessionsDir, { withFileTypes: true });
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
			throw err;
		}

		const infos: SessionInfo[] = [];
		for (const entry of entries) {
			if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
			const id = entry.name;
			if (!isValidSessionId(id)) continue;
			try {
				const record = await this.load(id);
				if (record) infos.push(record.info);
			} catch (err) {
				console.warn(
					`[session-store] skipping corrupt/incompatible session ${id}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
		return infos.sort((a, b) => b.updatedAt - a.updatedAt);
	}
}

let writeCounter = 0;

function validateRecord(parsed: unknown): StoredSessionRecord {
	if (!parsed || typeof parsed !== "object") {
		throw new Error("record is not an object");
	}
	const record = parsed as Partial<StoredSessionRecord>;
	const version = record.version;
	if (version !== CURRENT_RECORD_VERSION) {
		throw new Error(`unsupported record version ${version}`);
	}
	if (!record.info || typeof record.info !== "object") {
		throw new Error("missing session info");
	}
	if (
		!isValidSessionId(record.info.id) ||
		typeof record.info.agentName !== "string" ||
		typeof record.info.title !== "string" ||
		!record.info.model ||
		typeof record.info.model.provider !== "string" ||
		typeof record.info.model.id !== "string"
	) {
		throw new Error("invalid session info");
	}
	if (!Array.isArray(record.messages)) {
		throw new Error("messages must be an array");
	}
	if (!record.sidecar || typeof record.sidecar !== "object") {
		throw new Error("missing session sidecar");
	}

	return record as StoredSessionRecord;
}
