import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCliArgs } from "../src/cli-args.ts";

describe("DeepScience CLI arguments", () => {
	it("uses medium thinking and the current project by default", () => {
		const parsed = parseCliArgs([], "/project");
		assert.equal(parsed.command, "agent");
		assert.equal(parsed.thinking, "medium");
		assert.equal(parsed.thinkingSpecified, false);
		assert.equal(parsed.project, "/project");
	});

	it("parses the WebUI command", () => {
		const parsed = parseCliArgs(["web"], "/project");
		assert.equal(parsed.command, "web");
		assert.equal(parsed.project, "/project");
		assert.equal(parsed.port, undefined);
	});

	it("parses WebUI port and Workspace options", () => {
		const parsed = parseCliArgs(["web", "--port", "8080", "--workspace", "./research"], "/project");
		assert.equal(parsed.command, "web");
		assert.equal(parsed.port, 8080);
		assert.equal(parsed.project, "./research");

		const alias = parseCliArgs(["web", "--project", "/data/project"]);
		assert.equal(alias.project, "/data/project");
	});

	it("validates WebUI-only arguments", () => {
		assert.throws(() => parseCliArgs(["web", "--port", "0"]), /Invalid port/);
		assert.throws(() => parseCliArgs(["web", "--port", "65536"]), /Invalid port/);
		assert.throws(() => parseCliArgs(["web", "--port", "abc"]), /Invalid port/);
		assert.throws(() => parseCliArgs(["web", "extra"]), /Unexpected web argument/);
		assert.throws(() => parseCliArgs(["web", "--agent", "biology"]), /Unknown web option/);
	});

	it("tracks an explicitly selected thinking level", () => {
		const parsed = parseCliArgs(["--thinking", "high"]);
		assert.equal(parsed.thinking, "high");
		assert.equal(parsed.thinkingSpecified, true);
	});

	it("parses task, agent, model and print mode", () => {
		const parsed = parseCliArgs(["-p", "--agent", "biology", "--model", "zai/glm-5", "find", "genes"]);
		assert.equal(parsed.print, true);
		assert.equal(parsed.agent, "biology");
		assert.deepEqual(parsed.model, { provider: "zai", id: "glm-5" });
		assert.equal(parsed.prompt, "find genes");
	});

	it("rejects ambiguous session selection", () => {
		assert.throws(() => parseCliArgs(["--session", "sess_1", "--continue"]), /either --session or --continue/);
	});

	it("rejects malformed model selectors", () => {
		assert.throws(() => parseCliArgs(["--model", "glm-5"]), /provider\/model/);
	});
});
