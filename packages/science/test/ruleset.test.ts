import assert from "node:assert";
import { describe, it } from "node:test";
import { evaluate, fromConfig, isToolAllowed, merge, type Ruleset, wildcardMatch } from "../src/permission/ruleset.ts";

describe("permission ruleset", () => {
	describe("fromConfig", () => {
		it("converts simple allow rules", () => {
			const rs = fromConfig({ "*": "allow" });
			assert.deepStrictEqual(rs, [{ permission: "*", action: "allow", pattern: "*" }]);
		});

		it("converts nested rules", () => {
			const rs = fromConfig({ read: { "*.env": "deny", "*": "allow" } });
			assert.strictEqual(rs.length, 2);
			assert.deepStrictEqual(rs[0], { permission: "read", action: "deny", pattern: "*.env" });
		});
	});

	describe("merge", () => {
		it("flattens rulesets", () => {
			const a = fromConfig({ bash: "allow" });
			const b = fromConfig({ read: "allow" });
			const merged = merge(a, b);
			assert.strictEqual(merged.length, 2);
		});
	});

	describe("wildcardMatch", () => {
		it("matches exact strings", () => {
			assert.strictEqual(wildcardMatch("read", "read"), true);
		});

		it("matches wildcard", () => {
			assert.strictEqual(wildcardMatch("anything", "*"), true);
		});

		it("matches file pattern", () => {
			assert.strictEqual(wildcardMatch(".env", "*.env"), true);
		});

		it("rejects non-matching", () => {
			assert.strictEqual(wildcardMatch("write", "read"), false);
		});

		it("case insensitive", () => {
			assert.strictEqual(wildcardMatch("READ", "read"), true);
		});
	});

	describe("evaluate", () => {
		it("returns ask when no match", () => {
			const rs = fromConfig({ bash: "allow" });
			const result = evaluate("read", "foo.txt", rs);
			assert.strictEqual(result.action, "ask");
		});

		it("returns matching rule", () => {
			const rs = fromConfig({ read: "allow" });
			const result = evaluate("read", "foo.txt", rs);
			assert.strictEqual(result.action, "allow");
		});

		it("last matching rule wins", () => {
			const a = fromConfig({ read: "allow" });
			const b = fromConfig({ read: "deny" });
			const result = evaluate("read", "foo.txt", a, b);
			assert.strictEqual(result.action, "deny");
		});
	});

	describe("isToolAllowed", () => {
		const rs: Ruleset = [
			{ permission: "*", action: "allow", pattern: "*" },
			{ permission: "dangerous_tool", action: "deny", pattern: "*" },
		];

		it("allows unlisted tool", () => {
			assert.strictEqual(isToolAllowed("read", rs), true);
		});

		it("denies blocked tool", () => {
			assert.strictEqual(isToolAllowed("dangerous_tool", rs), false);
		});

		it("allows tools when no matching deny rule", () => {
			assert.strictEqual(isToolAllowed("any_tool", []), true);
		});
	});
});
