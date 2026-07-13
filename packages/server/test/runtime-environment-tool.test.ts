import assert from "node:assert";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createRuntimeEnvironmentTool, inspectRuntimeEnvironment } from "../src/runtime-environment-tool.ts";

describe("runtime environment tool", () => {
	let root = "";
	let bin = "";
	let project = "";
	let venv = "";
	let env: NodeJS.ProcessEnv;

	before(async () => {
		root = await mkdtemp(join(tmpdir(), "deepscience-runtime-environment-"));
		bin = join(root, "bin");
		project = join(root, "project");
		venv = join(project, ".venv");
		await Promise.all([mkdir(bin), mkdir(venv, { recursive: true })]);
		await writeFile(join(project, "pyproject.toml"), '[tool.poetry]\nname = "fixture"\n', "utf8");
		await writeFile(join(project, "environment.yml"), "name: fixture\n", "utf8");
		await writeFile(join(venv, "pyvenv.cfg"), "version = 3.12.4\n", "utf8");
		await writeFile(
			join(bin, "python"),
			`#!/bin/sh
printf '%s\n' '{"version":"3.12.4","implementation":"CPython","executable":"${join(venv, "bin/python")}","prefix":"${venv}","basePrefix":"/usr","isVirtualEnvironment":true,"venvModuleAvailable":true}'
`,
			"utf8",
		);
		await writeFile(
			join(bin, "conda"),
			`#!/bin/sh
if [ "$1" = "--version" ]; then
  printf '%s\n' 'conda 25.3.0'
else
  printf '%s\n' '{"envs":["${venv}","${join(root, "conda", "analysis")}"]}'
fi
`,
			"utf8",
		);
		await Promise.all([chmod(join(bin, "python"), 0o755), chmod(join(bin, "conda"), 0o755)]);
		env = {
			PATH: [bin, "/usr/bin", "/bin"].join(delimiter),
			SHELL: "/bin/bash",
			CONDA_PREFIX: venv,
			CONDA_DEFAULT_ENV: "fixture",
		};
	});

	after(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("detects active Conda, Python virtual environments, managers, and project declarations", async () => {
		const report = await inspectRuntimeEnvironment(
			{ directory: project, projectDirectory: project },
			{ env, platform: "linux", arch: "x64", release: "fixture", homeDirectory: root },
		);
		const managers = report.managers as Array<Record<string, unknown>>;
		const environments = report.environments as Array<Record<string, unknown>>;
		const markers = report.projectMarkers as Array<Record<string, unknown>>;
		const interpreters = report.python as Array<Record<string, unknown>>;

		assert.deepStrictEqual(
			managers.find((manager) => manager.name === "conda"),
			{
				name: "conda",
				installed: true,
				path: join(bin, "conda"),
				version: "conda 25.3.0",
				active: true,
				environmentCount: 2,
				diagnostic: undefined,
			},
		);
		assert.strictEqual(interpreters[0]?.version, "3.12.4");
		assert.strictEqual(interpreters[0]?.isVirtualEnvironment, true);
		assert.strictEqual(interpreters[0]?.venvModuleAvailable, true);
		assert.strictEqual(environments.find((environment) => environment.path === venv)?.active, true);
		assert.ok(markers.some((marker) => marker.type === "Conda environment specification"));
		assert.match((report.diagnostics as string[]).join("\n"), /declares poetry.*not available/i);
	});

	it("exposes the inventory as a read-only Agent tool", async () => {
		const originalPath = process.env.PATH;
		const originalCondaPrefix = process.env.CONDA_PREFIX;
		process.env.PATH = env.PATH;
		process.env.CONDA_PREFIX = venv;
		try {
			const tool = createRuntimeEnvironmentTool({ directory: project, projectDirectory: project });
			const result = await tool.execute("environment-call", {});
			const output = result.content[0]?.type === "text" ? result.content[0].text : "";
			assert.match(output, /"schemaVersion": 1/);
			assert.match(output, /"conda"/);
			assert.strictEqual(result.details.readOnly, true);
		} finally {
			if (originalPath === undefined) delete process.env.PATH;
			else process.env.PATH = originalPath;
			if (originalCondaPrefix === undefined) delete process.env.CONDA_PREFIX;
			else process.env.CONDA_PREFIX = originalCondaPrefix;
		}
	});
});
