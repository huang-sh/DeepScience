import assert from "node:assert";
import { describe, it } from "node:test";
import { isAllowedHost, isCrossOrigin } from "../src/host-guard.ts";

describe("host guard", () => {
	describe("isAllowedHost", () => {
		it("accepts localhost", () => {
			assert.strictEqual(isAllowedHost("localhost"), true);
		});

		it("accepts localhost with port", () => {
			assert.strictEqual(isAllowedHost("localhost:3000"), true);
		});

		it("accepts 127.0.0.1", () => {
			assert.strictEqual(isAllowedHost("127.0.0.1"), true);
		});

		it("accepts 127.0.0.1 with port", () => {
			assert.strictEqual(isAllowedHost("127.0.0.1:3000"), true);
		});

		it("accepts IPv6 loopback", () => {
			assert.strictEqual(isAllowedHost("[::1]"), true);
		});

		it("accepts IPv6 loopback with port", () => {
			assert.strictEqual(isAllowedHost("[::1]:3000"), true);
		});

		it("rejects external host", () => {
			assert.strictEqual(isAllowedHost("evil.com"), false);
		});

		it("rejects empty host", () => {
			assert.strictEqual(isAllowedHost(""), false);
		});

		it("rejects 0.0.0.0", () => {
			assert.strictEqual(isAllowedHost("0.0.0.0"), false);
		});
	});

	describe("isCrossOrigin", () => {
		it("allows localhost origin", () => {
			assert.strictEqual(isCrossOrigin("http://localhost:5174", undefined), false);
		});

		it("allows 127.0.0.1 origin", () => {
			assert.strictEqual(isCrossOrigin("http://127.0.0.1:5174", undefined), false);
		});

		it("rejects external origin", () => {
			assert.strictEqual(isCrossOrigin("https://evil.com", undefined), true);
		});

		it("rejects cross-site without origin", () => {
			assert.strictEqual(isCrossOrigin(undefined, "cross-site"), true);
		});

		it("allows no origin and no cross-site", () => {
			assert.strictEqual(isCrossOrigin(undefined, undefined), false);
		});

		it("allows same-origin via sec-fetch-site", () => {
			assert.strictEqual(isCrossOrigin(undefined, "same-origin"), false);
		});
	});
});
