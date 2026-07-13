import { randomUUID } from "node:crypto";
import type { AuthEvent, AuthPrompt, CredentialStore, Models, OAuthAuth } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { credentialStore } from "./credential-store.ts";

export type ProviderOAuthPhase = "pending" | "waiting" | "complete" | "error" | "cancelled";

export interface ProviderOAuthPrompt {
	id: string;
	type: AuthPrompt["type"];
	message: string;
	placeholder?: string;
	options?: Array<{ id: string; label: string; description?: string }>;
}

export interface ProviderOAuthJobStatus {
	id: string;
	provider: string;
	providerName: string;
	authName: string;
	phase: ProviderOAuthPhase;
	event?: AuthEvent;
	prompt?: ProviderOAuthPrompt;
	error?: string;
	createdAt: number;
	updatedAt: number;
}

interface PendingPrompt {
	id: string;
	resolve: (value: string) => void;
	reject: (error: Error) => void;
	dispose: () => void;
}

interface ProviderOAuthJob extends ProviderOAuthJobStatus {
	controller: AbortController;
	pendingPrompt?: PendingPrompt;
}

type ProviderLookup = Pick<Models, "getProvider">;

const TERMINAL_JOB_TTL_MS = 10 * 60 * 1000;

function abortError(message: string): Error {
	const error = new Error(message);
	error.name = "AbortError";
	return error;
}

export class ProviderOAuthManager {
	private models: ProviderLookup;
	private credentials: CredentialStore;
	private jobs = new Map<string, ProviderOAuthJob>();
	private activeByProvider = new Map<string, string>();

	constructor(models: ProviderLookup, credentials: CredentialStore) {
		this.models = models;
		this.credentials = credentials;
	}

	listCapabilities(): Map<string, { oauthSupported: boolean; oauthName?: string }> {
		const result = new Map<string, { oauthSupported: boolean; oauthName?: string }>();
		for (const providerId of ["anthropic", "openai-codex", "github-copilot"]) {
			const oauth = this.models.getProvider(providerId)?.auth.oauth;
			result.set(providerId, { oauthSupported: oauth !== undefined, oauthName: oauth?.name });
		}
		return result;
	}

	async isOAuthStored(providerId: string): Promise<boolean> {
		return (await this.credentials.read(providerId))?.type === "oauth";
	}

	start(providerId: string): ProviderOAuthJobStatus {
		this.prune();
		const provider = this.models.getProvider(providerId);
		const oauth = provider?.auth.oauth;
		if (!provider || !oauth) throw new Error(`OAuth login is not supported for provider: ${providerId}`);

		const activeId = this.activeByProvider.get(providerId);
		const active = activeId ? this.jobs.get(activeId) : undefined;
		if (active && (active.phase === "pending" || active.phase === "waiting")) return this.toStatus(active);

		const now = Date.now();
		const job: ProviderOAuthJob = {
			id: `oauth_${randomUUID()}`,
			provider: provider.id,
			providerName: provider.name,
			authName: oauth.name,
			phase: "pending",
			createdAt: now,
			updatedAt: now,
			controller: new AbortController(),
		};
		this.jobs.set(job.id, job);
		this.activeByProvider.set(providerId, job.id);
		void this.run(job, oauth);
		return this.toStatus(job);
	}

	get(id: string): ProviderOAuthJobStatus | undefined {
		this.prune();
		const job = this.jobs.get(id);
		return job ? this.toStatus(job) : undefined;
	}

	respond(id: string, promptId: string, value: string): ProviderOAuthJobStatus {
		const job = this.jobs.get(id);
		if (!job) throw new Error("OAuth login job not found");
		const pending = job.pendingPrompt;
		if (!pending || pending.id !== promptId) throw new Error("OAuth prompt is no longer active");
		pending.dispose();
		job.pendingPrompt = undefined;
		job.prompt = undefined;
		job.phase = "pending";
		job.updatedAt = Date.now();
		pending.resolve(value);
		return this.toStatus(job);
	}

	cancel(id: string): ProviderOAuthJobStatus {
		const job = this.jobs.get(id);
		if (!job) throw new Error("OAuth login job not found");
		if (job.phase === "pending" || job.phase === "waiting") {
			job.controller.abort();
			job.pendingPrompt?.dispose();
			job.pendingPrompt?.reject(abortError("Login cancelled"));
			job.pendingPrompt = undefined;
			job.prompt = undefined;
			job.phase = "cancelled";
			job.updatedAt = Date.now();
		}
		return this.toStatus(job);
	}

	async logout(providerId: string): Promise<void> {
		const provider = this.models.getProvider(providerId);
		if (!provider?.auth.oauth) throw new Error(`OAuth login is not supported for provider: ${providerId}`);
		const activeId = this.activeByProvider.get(providerId);
		if (activeId) this.cancel(activeId);
		await this.credentials.delete(providerId);
	}

	private async run(job: ProviderOAuthJob, oauth: OAuthAuth): Promise<void> {
		try {
			const credential = await oauth.login({
				signal: job.controller.signal,
				notify: (event) => {
					job.event = event;
					job.updatedAt = Date.now();
				},
				prompt: (prompt) => this.waitForPrompt(job, prompt),
			});
			if (job.controller.signal.aborted) throw abortError("Login cancelled");
			await this.credentials.modify(job.provider, async () => credential);
			job.prompt = undefined;
			job.pendingPrompt = undefined;
			job.phase = "complete";
			job.updatedAt = Date.now();
		} catch (error) {
			job.prompt = undefined;
			job.pendingPrompt = undefined;
			job.phase = job.controller.signal.aborted ? "cancelled" : "error";
			job.error = job.phase === "error" ? (error instanceof Error ? error.message : String(error)) : undefined;
			job.updatedAt = Date.now();
		} finally {
			if (this.activeByProvider.get(job.provider) === job.id) this.activeByProvider.delete(job.provider);
		}
	}

	private waitForPrompt(job: ProviderOAuthJob, prompt: AuthPrompt): Promise<string> {
		const promptId = `prompt_${randomUUID()}`;
		job.prompt = {
			id: promptId,
			type: prompt.type,
			message: prompt.message,
			placeholder: prompt.type === "select" ? undefined : prompt.placeholder,
			options: prompt.type === "select" ? [...prompt.options] : undefined,
		};
		job.phase = "waiting";
		job.updatedAt = Date.now();

		return new Promise<string>((resolve, reject) => {
			const onAbort = () => {
				const pending = job.pendingPrompt;
				if (pending?.id !== promptId) return;
				pending.dispose();
				job.pendingPrompt = undefined;
				job.prompt = undefined;
				reject(abortError("OAuth prompt cancelled"));
			};
			const signals = [job.controller.signal, prompt.signal].filter(
				(signal): signal is AbortSignal => signal !== undefined,
			);
			for (const signal of signals) signal.addEventListener("abort", onAbort, { once: true });
			const dispose = () => {
				for (const signal of signals) signal.removeEventListener("abort", onAbort);
			};
			job.pendingPrompt = { id: promptId, resolve, reject, dispose };
			if (signals.some((signal) => signal.aborted)) onAbort();
		});
	}

	private toStatus(job: ProviderOAuthJob): ProviderOAuthJobStatus {
		return {
			id: job.id,
			provider: job.provider,
			providerName: job.providerName,
			authName: job.authName,
			phase: job.phase,
			event: job.event,
			prompt: job.prompt,
			error: job.error,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
		};
	}

	private prune(): void {
		const cutoff = Date.now() - TERMINAL_JOB_TTL_MS;
		for (const [id, job] of this.jobs) {
			if (
				(job.phase === "complete" || job.phase === "error" || job.phase === "cancelled") &&
				job.updatedAt < cutoff
			) {
				this.jobs.delete(id);
			}
		}
	}
}

export const providerOAuth = new ProviderOAuthManager(builtinModels({ credentials: credentialStore }), credentialStore);

export async function enrichProviderOAuthStatus<T extends { id: string }>(
	providers: T[],
): Promise<Array<T & { oauthSupported: boolean; oauthName?: string; oauthStored: boolean }>> {
	const capabilities = providerOAuth.listCapabilities();
	return Promise.all(
		providers.map(async (provider) => ({
			...provider,
			oauthSupported: capabilities.get(provider.id)?.oauthSupported ?? false,
			oauthName: capabilities.get(provider.id)?.oauthName,
			oauthStored: await providerOAuth.isOAuthStored(provider.id),
		})),
	);
}
