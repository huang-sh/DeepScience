import assert from "node:assert";
import { after, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { InMemoryCredentialStore, type OAuthAuth } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { ProviderOAuthManager } from "../src/provider-oauth.ts";

async function waitFor(
	manager: ProviderOAuthManager,
	jobId: string,
	predicate: (phase: string, promptId?: string) => boolean,
) {
	for (let attempt = 0; attempt < 100; attempt++) {
		const job = manager.get(jobId);
		if (job && predicate(job.phase, job.prompt?.id)) return job;
		await delay(5);
	}
	throw new Error("Timed out waiting for OAuth job state");
}

describe("provider OAuth manager", () => {
	const credentials = new InMemoryCredentialStore();
	const models = builtinModels({ credentials });
	const original = models.getProvider("openai-codex");
	assert.ok(original);
	const oauth: OAuthAuth = {
		name: "Test subscription",
		login: async (callbacks) => {
			callbacks.notify({ type: "auth_url", url: "https://example.test/authorize" });
			const method = await callbacks.prompt({
				type: "select",
				message: "Choose login method",
				options: [{ id: "browser", label: "Browser" }],
			});
			assert.strictEqual(method, "browser");
			const code = await callbacks.prompt({ type: "manual_code", message: "Paste code" });
			assert.strictEqual(code, "test-code");
			return { type: "oauth", access: "secret-access", refresh: "secret-refresh", expires: Date.now() + 60_000 };
		},
		refresh: async (credential) => credential,
		toAuth: async (credential) => ({ apiKey: credential.access }),
	};
	models.setProvider({ ...original, auth: { oauth } });
	const manager = new ProviderOAuthManager(models, credentials);

	after(async () => credentials.delete("openai-codex"));

	it("bridges prompts without exposing the stored credential", async () => {
		let job = manager.start("openai-codex");
		assert.strictEqual(job.phase, "waiting");
		assert.strictEqual(job.event?.type, "auth_url");
		assert.strictEqual(job.prompt?.type, "select");

		job = manager.respond(job.id, job.prompt?.id ?? "", "browser");
		job = await waitFor(manager, job.id, (phase, promptId) => phase === "waiting" && promptId !== undefined);
		assert.strictEqual(job.prompt?.type, "manual_code");

		manager.respond(job.id, job.prompt?.id ?? "", "test-code");
		job = await waitFor(manager, job.id, (phase) => phase === "complete");
		assert.strictEqual(job.phase, "complete");
		assert.doesNotMatch(JSON.stringify(job), /secret-access|secret-refresh/);
		assert.strictEqual((await credentials.read("openai-codex"))?.type, "oauth");
	});

	it("removes stored OAuth credentials on logout", async () => {
		await manager.logout("openai-codex");
		assert.strictEqual(await credentials.read("openai-codex"), undefined);
	});
});
