import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { Ruleset } from "@shying/ds-science";
import type { SessionSidecar } from "../session-store.ts";
import type { WorkspaceInstance } from "../workspace-instance.ts";

export interface CapabilityContext {
	agentName: string;
	permission: Ruleset;
	sessionID?: string;
	workspace?: WorkspaceInstance;
	getSidecar(): SessionSidecar | undefined;
}

export interface DeepScienceCapability {
	id: string;
	create(context: CapabilityContext): Promise<CapabilityContribution | undefined>;
}

export interface CapabilityContribution {
	extension?: ExtensionFactory;
	extensionPaths?: string[];
	appendSystemPrompt?: string;
}

export interface CapabilityState {
	loaded?: string[];
	[key: string]: unknown;
}

export function getCapabilityState(sidecar: SessionSidecar | undefined, capabilityID: string): CapabilityState {
	if (!sidecar) return {};
	const existing = sidecar.capabilities?.[capabilityID];
	return existing ?? {};
}

export function getLoadedCapabilityEntries(sidecar: SessionSidecar | undefined, capabilityID: string): string[] {
	return getCapabilityState(sidecar, capabilityID).loaded ?? [];
}

export function markCapabilityEntryLoaded(
	sidecar: SessionSidecar | undefined,
	capabilityID: string,
	entryName: string,
): void {
	if (!sidecar) return;
	const capabilities = sidecar.capabilities ?? {};
	const state = capabilities[capabilityID] ?? {};
	state.loaded = [...new Set([...(state.loaded ?? []), entryName])].sort();
	capabilities[capabilityID] = state;
	sidecar.capabilities = capabilities;
}
