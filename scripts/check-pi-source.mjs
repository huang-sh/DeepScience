#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const packages = [
	{ directory: "agent", name: "pi-agent-core" },
	{ directory: "ai", name: "pi-ai" },
	{ directory: "coding-agent", name: "pi-coding-agent" },
	{ directory: "tui", name: "pi-tui" },
	{ directory: "orchestrator", name: "pi-orchestrator" },
];

const errors = [];
const versions = new Set();

for (const pkg of packages) {
	const legacyPath = resolve("packages", pkg.directory);
	if (existsSync(legacyPath)) errors.push(`duplicate Pi source exists: ${legacyPath}`);

	const vendorPath = resolve("vendor/pi/packages", pkg.directory);
	const manifestPath = resolve(vendorPath, "package.json");
	if (!existsSync(manifestPath)) {
		errors.push(`Pi submodule package is missing: ${manifestPath}`);
		continue;
	}
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	versions.add(manifest.version);

	const installedPath = resolve("node_modules/@earendil-works", pkg.name);
	if (!existsSync(installedPath)) {
		errors.push(`Pi workspace link is missing: ${installedPath}; run npm install`);
		continue;
	}
	if (realpathSync(installedPath) !== realpathSync(vendorPath)) {
		errors.push(`${manifest.name} resolves outside vendor/pi: ${realpathSync(installedPath)}`);
	}
}

if (versions.size > 1) errors.push(`Pi packages are not lockstep versioned: ${[...versions].join(", ")}`);

if (errors.length > 0) {
	console.error("Pi source validation failed:");
	for (const error of errors) console.error(`  - ${error}`);
	process.exit(1);
}

console.log(`Pi source: vendor/pi (${[...versions][0]})`);
