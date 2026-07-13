import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Credential, CredentialStore } from "@earendil-works/pi-ai";

interface CredentialFile {
	version: 1;
	providers: Record<string, Credential>;
}

let writeQueue = Promise.resolve();

function credentialPath(): string {
	const dataRoot = process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience");
	return join(dataRoot, "credentials.json");
}

function isCredential(value: unknown): value is Credential {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const credential = value as Partial<Credential>;
	if (credential.type === "api_key") {
		return credential.key === undefined || typeof credential.key === "string";
	}
	return (
		credential.type === "oauth" &&
		typeof credential.access === "string" &&
		typeof credential.refresh === "string" &&
		typeof credential.expires === "number"
	);
}

async function readFileState(): Promise<CredentialFile> {
	try {
		const parsed: unknown = JSON.parse(await readFile(credentialPath(), "utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("credentials.json must contain an object");
		}
		const input = parsed as { version?: unknown; providers?: unknown };
		if (input.version !== 1 || !input.providers || typeof input.providers !== "object") {
			throw new Error("credentials.json has an unsupported format");
		}
		const providers: Record<string, Credential> = {};
		for (const [provider, credential] of Object.entries(input.providers)) {
			if (!isCredential(credential)) throw new Error(`Invalid credential for provider ${provider}`);
			providers[provider] = credential;
		}
		return { version: 1, providers };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, providers: {} };
		throw error;
	}
}

async function writeFileState(state: CredentialFile): Promise<void> {
	const target = credentialPath();
	const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
	await mkdir(dirname(target), { recursive: true, mode: 0o700 });
	try {
		await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
		await rename(temporary, target);
	} finally {
		await rm(temporary, { force: true }).catch(() => undefined);
	}
}

/** Persistent Pi-AI credential storage owned by DeepScience. */
class DeepScienceCredentialStore implements CredentialStore {
	async read(providerId: string): Promise<Credential | undefined> {
		return (await readFileState()).providers[providerId];
	}

	async modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined> {
		let result: Credential | undefined;
		const write = writeQueue.then(async () => {
			const state = await readFileState();
			const next = await fn(state.providers[providerId]);
			if (next === undefined) {
				result = state.providers[providerId];
				return;
			}
			state.providers[providerId] = next;
			await writeFileState(state);
			result = next;
		});
		writeQueue = write.catch(() => undefined);
		await write;
		return result;
	}

	async delete(providerId: string): Promise<void> {
		const write = writeQueue.then(async () => {
			const state = await readFileState();
			if (!(providerId in state.providers)) return;
			delete state.providers[providerId];
			await writeFileState(state);
		});
		writeQueue = write.catch(() => undefined);
		await write;
	}
}

export const credentialStore: CredentialStore = new DeepScienceCredentialStore();
