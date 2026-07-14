import assert from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createSession, getSession, initializeSessionStore } from "../src/session.ts";

describe("DeepScience capability extensions", () => {
	it("exposes read_image to text Agents through the capability runtime", async () => {
		const root = mkdtempSync(join(tmpdir(), "ds-image-capability-"));
		initializeSessionStore({ rootDir: join(root, "data") });
		const info = await createSession("research", undefined, root);
		const managed = await getSession(info.id);
		assert.ok(managed?.agent.state.tools.some((tool) => tool.name === "read_image"));
		assert.match(managed?.agent.state.systemPrompt ?? "", /Session Image Reading/);
	});

	it("loads a new Pi extension without changing the session assembly", async () => {
		const root = mkdtempSync(join(tmpdir(), "ds-capability-extension-"));
		const extensionPath = join(root, "sample-extension.ts");
		writeFileSync(
			extensionPath,
			`import { Type } from "typebox";

export default function register(pi) {
  pi.registerTool({
    name: "sample_capability",
    label: "Sample capability",
    description: "Capability loaded through the Pi extension loader.",
    parameters: Type.Object({ value: Type.String() }),
    async execute(_id, params) {
      return { content: [{ type: "text", text: "extension:" + params.value }], details: {} };
    },
  });
}
`,
			"utf8",
		);
		const previousPaths = process.env.DEEPSCIENCE_EXTENSION_PATHS;
		process.env.DEEPSCIENCE_EXTENSION_PATHS = extensionPath;
		initializeSessionStore({ rootDir: join(root, "data") });
		try {
			const info = await createSession("research", undefined, root);
			const managed = await getSession(info.id);
			const tool = managed?.agent.state.tools.find((candidate) => candidate.name === "sample_capability");
			assert.ok(tool);
			const result = await tool.execute("sample-call", { value: "ok" });
			assert.strictEqual(result.content[0]?.type === "text" ? result.content[0].text : "", "extension:ok");
		} finally {
			if (previousPaths === undefined) delete process.env.DEEPSCIENCE_EXTENSION_PATHS;
			else process.env.DEEPSCIENCE_EXTENSION_PATHS = previousPaths;
		}
	});

	it("keeps named capability constructors out of the session assembly", () => {
		const source = readFileSync(new URL("../src/session.ts", import.meta.url), "utf8");
		assert.doesNotMatch(source, /createSkillTool|createResourceTool|createBasicTools/);
		assert.match(source, /createCapabilityRuntime/);
	});
});
