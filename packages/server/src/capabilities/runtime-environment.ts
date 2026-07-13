import { isToolAllowed } from "@shying/ds-science";
import { createRuntimeEnvironmentTool } from "../runtime-environment-tool.ts";
import { createToolExtension } from "./tool-extension.ts";
import type { DeepScienceCapability } from "./types.ts";

export const RUNTIME_ENVIRONMENT_CAPABILITY_ID = "runtime-environment";

export const runtimeEnvironmentCapability: DeepScienceCapability = {
	id: RUNTIME_ENVIRONMENT_CAPABILITY_ID,
	async create(context) {
		if (!isToolAllowed("environment", context.permission)) return undefined;
		const workspace = context.workspace;
		if (!workspace) return undefined;
		const tool = createRuntimeEnvironmentTool({
			directory: workspace.directory,
			projectDirectory: workspace.projectDirectory ?? workspace.worktree,
		});
		const prompt = `## Runtime Environment Inspection

The environment tool provides a read-only, structured inventory of the local execution environment. Call it when a task will run Python or depends on installed software and you need to choose between an existing Conda, Mamba, Micromamba, venv, virtualenv, uv, Poetry, Pipenv, pyenv, PDM, Hatch, Pixi, Rye, tox, or nox setup. Do not call it for greetings, conceptual answers, or tasks that do not execute local software.

### Environment selection and execution

Before the first local computation in a task:

1. Call environment and inspect the project declarations, active environment, available interpreters, and known managed environments.
2. Select one environment for the task. Prefer, in order: the environment explicitly declared by the project; an already-active compatible environment; an existing managed environment whose purpose and required packages can be verified; then a new workspace-local environment only when no compatible environment exists.
3. Verify only the task-critical interpreter and packages with one bounded command. Never infer compatibility solely from an environment name, and do not enumerate every installed package unless the task requires a complete environment audit.
4. Run every subsequent command explicitly in the selected environment. Bash calls are independent, so do not rely on a prior activate or source command persisting. Use the environment's absolute Python executable, conda run -p <prefix>, micromamba run -p <prefix>, uv run, poetry run, or the corresponding manager runner as appropriate.
5. Keep one environment throughout a coherent analysis unless a dependency conflict requires a deliberate switch. If switching, state why and verify the new environment before continuing.
6. Record the selected manager, environment path or name, Python version, and any environment creation or package installation in the final reproducibility notes.

Do not modify a shared or unrelated environment without a clear need. Prefer an environment inside the isolated execution Workspace for newly created task-specific environments, and keep generated results outside the environment directory. The environment tool itself never activates, creates, deletes, or modifies environments.`;
		return { extension: createToolExtension([tool]), appendSystemPrompt: prompt };
	},
};
