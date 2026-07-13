/**
 * Lightweight provenance metadata for scientific tool outputs.
 *
 * Adapted from OpenScience's provenance DAG pattern:
 * - sessionId: which session produced this result
 * - timestamp: when the tool executed
 * - tool: which tool produced this result
 *
 * This is intentionally lightweight — a full content-addressed DAG
 * (as in OpenScience's science/provenance/store.ts) can be added later
 * without changing the interface.
 */

export interface ProvenanceMeta {
	sessionId: string;
	timestamp: number;
	tool: string;
	/** Additional structured metadata the tool wants to record. */
	extra?: Record<string, unknown>;
}

/**
 * Attach provenance metadata to a details object, merging with any
 * existing fields. Generated provenance takes precedence so a tool cannot
 * accidentally or intentionally spoof the session metadata.
 */
export function withProvenance<T extends Record<string, unknown>>(
	details: T,
	prov: ProvenanceMeta,
): T & { provenance: ProvenanceMeta } {
	return { ...details, provenance: prov };
}

/**
 * Create a provenance snapshot from a tool execution context.
 */
export function createProvenance(sessionId: string, toolName: string, extra?: Record<string, unknown>): ProvenanceMeta {
	return {
		sessionId,
		timestamp: Date.now(),
		tool: toolName,
		...(extra ? { extra } : {}),
	};
}
