import { getToolsForAgent } from "@shying/ds-science";
import { RESOURCE_SKILLS_ROOT } from "../resource-package-catalog.ts";
import { createToolExtension } from "./tool-extension.ts";
import type { DeepScienceCapability } from "./types.ts";

export const workspaceCapability: DeepScienceCapability = {
	id: "workspace",
	async create(context) {
		const workspace = context.workspace;
		const tools = getToolsForAgent(
			context.agentName,
			context.permission,
			workspace
				? {
						directory: workspace.directory,
						worktree: workspace.worktree,
						projectDirectory: workspace.projectDirectory,
						resourceDirectory: RESOURCE_SKILLS_ROOT,
					}
				: undefined,
		);
		const prompt = workspace
			? `# Session Workspace

This session is bound to one user-selected workspace instance.
- Project ID: ${JSON.stringify(workspace.projectID)}
- Execution workspace: ${JSON.stringify(workspace.directory)}
- Project source alias: ${JSON.stringify(workspace.projectDirectory ?? workspace.worktree)}
- Read-only Resource packages: ${JSON.stringify(RESOURCE_SKILLS_ROOT)}
- Worktree root: ${JSON.stringify(workspace.worktree)}
- Instance type: ${workspace.workspaceKind}

Treat the execution workspace as the root for all relative file paths and generated artifacts. Store every generated image, table, script, notebook, report, and downloaded result directly in an appropriate subdirectory there. DeepScience has already isolated this Session below the selected Project's local .deepscience/workspace directory; do not create another nested .deepscience directory. Use project/<path> for the read-only project-source alias and resource/<path> or an exposed Resource absolute path for read-only Resource files with read, glob, grep, or ls. The write tool and bash working-directory are restricted to the execution workspace. Do not claim that this path isolation is an operating-system sandbox.

## Artifact Publication

The Artifacts panel is a curated publication surface, not a log of every tool result. Use the artifact tool only when a completed result is important for the user to inspect independently: a final figure, meaningful table, reusable dataset, equation, HTML view, molecular structure, report, or decision-critical structured finding. Do not publish routine reads, searches, command output, progress updates, failed attempts, or intermediate diagnostics. Keep artifact content concise and user-facing. Write generated files first, then pass only exact existing execution-workspace-relative paths to artifact. Publish PDB, CIF, mmCIF, or MOL2 files directly with kind=structure for interactive 3D viewing; do not wrap molecular coordinates in generated HTML. For other HTML, use kind=html and provide self-contained markup or an existing .html/.htm file; scripts and external resources are intentionally blocked. The artifact tool does not replace the final answer; summarize the conclusion in the final response as well.`
			: undefined;
		return { extension: createToolExtension(tools), appendSystemPrompt: prompt };
	},
};
