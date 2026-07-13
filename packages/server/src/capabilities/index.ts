import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { runtimeEnvironmentCapability } from "./runtime-environment.ts";
import { scientificResourcesCapability } from "./scientific-resources.ts";
import { skillLibraryCapability } from "./skill-library.ts";
import type { CapabilityContext, DeepScienceCapability } from "./types.ts";
import { workspaceCapability } from "./workspace.ts";

const BUILTIN_CAPABILITIES: readonly DeepScienceCapability[] = [
	workspaceCapability,
	runtimeEnvironmentCapability,
	skillLibraryCapability,
	scientificResourcesCapability,
];

export async function createCapabilityRuntime(context: CapabilityContext): Promise<{
	extensionFactories: ExtensionFactory[];
	appendSystemPrompt: string[];
}> {
	const contributions = (
		await Promise.all(BUILTIN_CAPABILITIES.map((capability) => capability.create(context)))
	).filter((contribution): contribution is NonNullable<typeof contribution> => contribution !== undefined);
	return {
		extensionFactories: contributions.map((contribution) => contribution.extension),
		appendSystemPrompt: contributions.flatMap((contribution) =>
			contribution.appendSystemPrompt ? [contribution.appendSystemPrompt] : [],
		),
	};
}

export { RUNTIME_ENVIRONMENT_CAPABILITY_ID } from "./runtime-environment.ts";
export { SCIENTIFIC_RESOURCES_CAPABILITY_ID } from "./scientific-resources.ts";
export { SKILL_LIBRARY_CAPABILITY_ID } from "./skill-library.ts";
export {
	type CapabilityContext,
	type CapabilityContribution,
	type CapabilityState,
	type DeepScienceCapability,
	getCapabilityState,
	getLoadedCapabilityEntries,
	markCapabilityEntryLoaded,
} from "./types.ts";
