import type { ToolCallPart } from "../types";

export interface ToolPresenter {
	statusLabel?: (part: ToolCallPart) => string;
}

const presenters = new Map<string, ToolPresenter>();

/** Register or replace the presentation policy for one tool. */
export function registerToolPresenter(tool: string, presenter: ToolPresenter): void {
	presenters.set(tool, presenter);
}

export function toolStatusLabel(part: ToolCallPart): string {
	if (part.status !== "done") return part.status;
	return presenters.get(part.tool)?.statusLabel?.(part) ?? "done";
}

function catalogStatusLabel(part: ToolCallPart): string {
	if (part.details?.loaded === true) return "loaded";
	const action = part.args?.action ?? (part.args?.name ? "read" : "list");
	return action === "read" ? "loaded" : "browsed";
}

registerToolPresenter("skill", { statusLabel: catalogStatusLabel });
registerToolPresenter("resource", { statusLabel: catalogStatusLabel });
