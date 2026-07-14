import assert from "node:assert/strict";
import { createServer } from "node:net";
import { after, before, describe, it } from "node:test";
import { assertPortAvailable } from "../src/port-availability.ts";

describe("Web server port availability", () => {
	const occupied = createServer();
	let port = 0;

	before(async () => {
		await new Promise<void>((resolve, reject) => {
			occupied.once("error", reject);
			occupied.listen({ host: "127.0.0.1", port: 0 }, () => {
				const address = occupied.address();
				if (!address || typeof address === "string") {
					reject(new Error("Failed to allocate a test port"));
					return;
				}
				port = address.port;
				resolve();
			});
		});
	});

	after(async () => {
		await new Promise<void>((resolve, reject) => {
			occupied.close((error) => (error ? reject(error) : resolve()));
		});
	});

	it("reports an occupied port with an actionable command", async () => {
		await assert.rejects(assertPortAvailable(port), new RegExp(`Port ${port} is already in use.*--port ${port + 1}`));
	});

	it("accepts an available port", async () => {
		await assert.doesNotReject(assertPortAvailable(0));
	});
});
