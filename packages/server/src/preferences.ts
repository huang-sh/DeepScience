import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ModelRef } from "./session-store.ts";

export interface DeepSciencePreferences {
	defaultAgent?: string;
	defaultModel?: ModelRef;
	updatedAt?: number;
}

let writeQueue = Promise.resolve();

function preferencesPath(): string {
	const dataRoot = process.env.DEEPSCIENCE_DATA_DIR ?? join(homedir(), ".deepscience");
	return join(dataRoot, "settings.json");
}

function validModel(value: unknown): value is ModelRef {
	if (!value || typeof value !== "object") return false;
	const model = value as Partial<ModelRef>;
	return (
		typeof model.provider === "string" &&
		model.provider.length > 0 &&
		typeof model.id === "string" &&
		model.id.length > 0 &&
		typeof model.name === "string" &&
		model.name.length > 0
	);
}

export async function readPreferences(): Promise<DeepSciencePreferences> {
	try {
		const parsed: unknown = JSON.parse(await readFile(preferencesPath(), "utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const input = parsed as Partial<DeepSciencePreferences>;
		return {
			defaultAgent:
				typeof input.defaultAgent === "string" && input.defaultAgent.length > 0 ? input.defaultAgent : undefined,
			defaultModel: validModel(input.defaultModel) ? input.defaultModel : undefined,
			updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : undefined,
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		console.warn(
			`[preferences] ignoring invalid settings: ${error instanceof Error ? error.message : String(error)}`,
		);
		return {};
	}
}

export async function savePreferences(
	patch: Pick<DeepSciencePreferences, "defaultAgent" | "defaultModel">,
): Promise<DeepSciencePreferences> {
	let saved: DeepSciencePreferences = {};
	const write = writeQueue.then(async () => {
		const current = await readPreferences();
		const next: DeepSciencePreferences = {
			...current,
			updatedAt: Date.now(),
		};
		if (patch.defaultAgent !== undefined) next.defaultAgent = patch.defaultAgent;
		if (patch.defaultModel !== undefined) next.defaultModel = patch.defaultModel;
		const target = preferencesPath();
		const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
		await mkdir(dirname(target), { recursive: true, mode: 0o700 });
		try {
			await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
			await rename(temporary, target);
		} finally {
			await rm(temporary, { force: true }).catch(() => undefined);
		}
		saved = next;
	});
	writeQueue = write.catch(() => undefined);
	await write;
	return saved;
}
